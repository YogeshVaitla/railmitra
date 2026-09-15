package com.railmitra.app.nearby

import android.Manifest
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*

/**
 * Native module that wraps the Google Nearby Connections API.
 *
 * Uses P2P_CLUSTER strategy for many-to-many discovery — perfect for
 * multiple passengers on the same train finding each other.
 *
 * Communication flow:
 * 1. Start advertising + discovery with a service ID like "railmitra_12301_2026-03-05"
 * 2. When endpoints are found, auto-connect
 * 3. Exchange swap offers as JSON payloads
 * 4. Emit events to JavaScript for UI updates
 */
class NearbyModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "NearbyModule"
        private const val NAME = "NearbyConnections"
    }

    override fun getName(): String = NAME

    private val connectionsClient: ConnectionsClient by lazy {
        Nearby.getConnectionsClient(reactContext)
    }

    private var serviceId = ""
    private var localName = ""
    private var isAdvertising = false
    private var isDiscovering = false

    // Track connected endpoints
    private val connectedEndpoints = mutableMapOf<String, String>() // endpointId -> endpointName
    private val discoveredNames = mutableMapOf<String, String>()
    private val connecting = mutableSetOf<String>()

    // --- Connection Lifecycle ---

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            if (!connecting.contains(endpointId) && connectedEndpoints.size + connecting.size >= 8) {
                connectionsClient.rejectConnection(endpointId)
                return
            }
            discoveredNames[endpointId] = info.endpointName
            connecting.add(endpointId)
            // Transport admission is not application authorization. V2 verifies every signed record.
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            connecting.remove(endpointId)
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    connectedEndpoints[endpointId] = discoveredNames[endpointId] ?: "RailMitra"
                    sendEvent("onConnectionResult", Arguments.createMap().apply {
                        putString("endpointId", endpointId)
                        putString("status", "CONNECTED")
                    })
                    // Send peer count update
                    sendEvent("onPeerCountChanged", Arguments.createMap().apply {
                        putInt("count", connectedEndpoints.size)
                    })
                }
                ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> {
                    Log.d(TAG, "Connection rejected by $endpointId")
                    connectedEndpoints.remove(endpointId)
                }
                else -> {
                    Log.d(TAG, "Connection failed with $endpointId: ${result.status}")
                    connectedEndpoints.remove(endpointId)
                }
            }
        }

        override fun onDisconnected(endpointId: String) {
            connectedEndpoints.remove(endpointId)
            discoveredNames.remove(endpointId)
            connecting.remove(endpointId)
            sendEvent("onEndpointLost", Arguments.createMap().apply {
                putString("endpointId", endpointId)
            })
            sendEvent("onPeerCountChanged", Arguments.createMap().apply {
                putInt("count", connectedEndpoints.size)
            })
        }
    }

    // --- Endpoint Discovery ---

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            if (connectedEndpoints.containsKey(endpointId) || connecting.contains(endpointId) || connectedEndpoints.size + connecting.size >= 8) return
            discoveredNames[endpointId] = info.endpointName
            connecting.add(endpointId)

            sendEvent("onEndpointFound", Arguments.createMap().apply {
                putString("endpointId", endpointId)
                putString("endpointName", info.endpointName)
            })

            // Auto-request connection
            connectionsClient.requestConnection(localName, endpointId, connectionLifecycleCallback)
                .addOnSuccessListener {
                    Log.d(TAG, "Connection request sent to $endpointId")
                }
                .addOnFailureListener { e ->
                    connecting.remove(endpointId)
                    discoveredNames.remove(endpointId)
                }
        }

        override fun onEndpointLost(endpointId: String) {
            // Discovery loss does not mean an established connection was lost.
            if (!connectedEndpoints.containsKey(endpointId)) discoveredNames.remove(endpointId)
        }
    }

    // --- Payload handling ---

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                val bytes = payload.asBytes() ?: return
                if (bytes.size > 4096) return
                val data = String(bytes, Charsets.UTF_8)
                sendEvent("onPayloadReceived", Arguments.createMap().apply {
                    putString("endpointId", endpointId)
                    putString("data", data)
                })
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // We only use BYTES payloads, these transfer instantly
        }
    }

    // --- Exposed Methods ---

    @ReactMethod
    fun startAdvertising(serviceName: String, serviceIdentifier: String, promise: Promise) {
        serviceId = serviceIdentifier
        localName = serviceName

        val options = AdvertisingOptions.Builder()
            .setStrategy(Strategy.P2P_CLUSTER)
            .build()

        connectionsClient.startAdvertising(localName, serviceId, connectionLifecycleCallback, options)
            .addOnSuccessListener {
                isAdvertising = true
                Log.d(TAG, "Advertising started for service: $serviceId")
                promise.resolve(true)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Advertising failed: ${e.message}")
                promise.reject("ADVERTISING_FAILED", e.message, e)
            }
    }

    @ReactMethod
    fun startDiscovery(serviceIdentifier: String, promise: Promise) {
        serviceId = serviceIdentifier

        val options = DiscoveryOptions.Builder()
            .setStrategy(Strategy.P2P_CLUSTER)
            .build()

        connectionsClient.startDiscovery(serviceId, endpointDiscoveryCallback, options)
            .addOnSuccessListener {
                isDiscovering = true
                Log.d(TAG, "Discovery started for service: $serviceId")
                promise.resolve(true)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "Discovery failed: ${e.message}")
                promise.reject("DISCOVERY_FAILED", e.message, e)
            }
    }

    @ReactMethod
    fun sendPayload(data: String, promise: Promise) {
        if (data.toByteArray(Charsets.UTF_8).size > 4096) {
            promise.reject("PAYLOAD_TOO_LARGE", "Payload exceeds 4096 bytes")
            return
        }
        val payload = Payload.fromBytes(data.toByteArray(Charsets.UTF_8))
        val endpoints = connectedEndpoints.keys.toList()

        if (endpoints.isEmpty()) {
            promise.resolve(false)
            return
        }

        connectionsClient.sendPayload(endpoints, payload)
            .addOnSuccessListener {
                Log.d(TAG, "Payload sent to ${endpoints.size} endpoint(s)")
                promise.resolve(true)
            }
            .addOnFailureListener { e ->
                Log.w(TAG, "Payload send failed: ${e.message}")
                promise.reject("SEND_FAILED", e.message, e)
            }
    }

    @ReactMethod
    fun sendPayloadToEndpoint(endpointId: String, data: String, promise: Promise) {
        if (!connectedEndpoints.containsKey(endpointId) || data.toByteArray(Charsets.UTF_8).size > 4096) {
            promise.reject("INVALID_PAYLOAD", "Endpoint unavailable or payload too large")
            return
        }
        connectionsClient.sendPayload(endpointId, Payload.fromBytes(data.toByteArray(Charsets.UTF_8)))
            .addOnSuccessListener { promise.resolve(true) }
            .addOnFailureListener { e -> promise.reject("SEND_FAILED", "Nearby send failed", e) }
    }

    @ReactMethod
    fun stopAll(promise: Promise) {
        try {
            connectionsClient.stopAdvertising()
            connectionsClient.stopDiscovery()
            connectionsClient.stopAllEndpoints()
            isAdvertising = false
            isDiscovering = false
            connectedEndpoints.clear()
            discoveredNames.clear()
            connecting.clear()
            Log.d(TAG, "All connections stopped")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun getConnectedEndpointCount(promise: Promise) {
        promise.resolve(connectedEndpoints.size)
    }

    @ReactMethod
    fun isActive(promise: Promise) {
        promise.resolve(isAdvertising || isDiscovering)
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    // --- Helpers ---

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
}
