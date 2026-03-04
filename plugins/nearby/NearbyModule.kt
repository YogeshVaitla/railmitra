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
    private val pendingPayloads = mutableMapOf<String, String>() // for endpoints not yet connected

    // --- Connection Lifecycle ---

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            Log.d(TAG, "Connection initiated with $endpointId (${info.endpointName})")
            // Auto-accept all connections for simplicity
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    val name = connectedEndpoints[endpointId] ?: "unknown"
                    Log.d(TAG, "Connected to $endpointId ($name)")
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
            Log.d(TAG, "Disconnected from $endpointId")
            connectedEndpoints.remove(endpointId)
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
            Log.d(TAG, "Endpoint found: $endpointId (${info.endpointName})")
            connectedEndpoints[endpointId] = info.endpointName

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
                    Log.w(TAG, "Connection request failed to $endpointId: ${e.message}")
                }
        }

        override fun onEndpointLost(endpointId: String) {
            Log.d(TAG, "Endpoint lost: $endpointId")
            connectedEndpoints.remove(endpointId)
            sendEvent("onEndpointLost", Arguments.createMap().apply {
                putString("endpointId", endpointId)
            })
            sendEvent("onPeerCountChanged", Arguments.createMap().apply {
                putInt("count", connectedEndpoints.size)
            })
        }
    }

    // --- Payload handling ---

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                val data = String(payload.asBytes()!!, Charsets.UTF_8)
                Log.d(TAG, "Payload received from $endpointId: ${data.take(100)}...")
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
    fun stopAll(promise: Promise) {
        try {
            connectionsClient.stopAdvertising()
            connectionsClient.stopDiscovery()
            connectionsClient.stopAllEndpoints()
            isAdvertising = false
            isDiscovering = false
            connectedEndpoints.clear()
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
