const fs=require('node:fs');
const path=require('node:path');
function check(ok,message){if(!ok)throw new Error(message);}
const props=fs.readFileSync('android/gradle.properties','utf8');
check(/android.targetSdkVersion=36/.test(props),'Target SDK must be 36');
const app=fs.readFileSync('android/app/src/main/java/com/railmitra/app/MainApplication.kt','utf8');
check((app.match(/add\(NearbyPackage\(\)\)/g)||[]).length===1,'Nearby package registration must exist exactly once');
const source=fs.readFileSync('plugins/nearby/NearbyModule.kt','utf8');
check(source===fs.readFileSync('android/app/src/main/java/com/railmitra/app/nearby/NearbyModule.kt','utf8'),'Generated native module differs from source');
check(source.includes('fun sendPayloadToEndpoint('),'Missing native relay interface');
if(process.argv.includes('--merged')){
  function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
  const file=walk('android/app/build/intermediates').find(p=>/merged_manifest(s)?\/release\//.test(p)&&p.endsWith('AndroidManifest.xml'));
  check(file,'Release merged manifest not found');
  const xml=fs.readFileSync(file,'utf8');
  check(/targetSdkVersion="36"/.test(xml),'Final merged target SDK incorrect');
  check(!/android:debuggable="true"/.test(xml),'Release must not be debuggable');
  for(const p of ['ACCESS_BACKGROUND_LOCATION','RECORD_AUDIO','SYSTEM_ALERT_WINDOW','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE'])check(!new RegExp('uses-permission[^>]*android.permission.'+p+'["\\s]').test(xml),'Unexpected release permission: '+p);
}
console.log('Native generation checks passed. Signing, 16KB ELF/page alignment and physical-device tests are separate release gates.');
