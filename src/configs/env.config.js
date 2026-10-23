const fs = require('fs');
const path = require('path');

function loadDotenv(){
    const envPath = path.join(__dirname, '..', '..', '.env');

    if(!fs.existsSync(envPath)){
        return;
    }

   const contents = fs.readFileSync(envPath, 'utf-8');

   for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if(!trimmed || trimmed.startsWith('#')) {
        continue;
    }

    const separatorIndex = trimmed.indexOf('=');
     if(separatorIndex === -1) {
        continue;
     }

     const key = trimmed.slice(0, separatorIndex).trim();
     const value = trimmed.slice(separatorIndex + 1).trim();
          
     if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        process.env[key] = value.slice(1, -1);
     } 

     if(process.env[key]=== undefined) {
        process.env[key] = value;
     }
   }

}


loadDotenv();

function toInt (value, fallback){
    const parsed = parseInt(value,10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat (value, fallback){
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}


const PORT = toInt(process.env.PORT, 3000);
const MAX_UPLOAD_MB = toInt(process.env.MAX_UPLOAD_MB, 25);
const PREVIEW_SCALE = toFloat(process.env.PREVIEW_SCALE, 1.5);
const TMP_TTL_HOURS = toInt(process.env.TMP_TTL_HOURS, 2);

module.exports = {
    PORT,
    MAX_UPLOAD_MB,
    PREVIEW_SCALE,
    TMP_TTL_HOURS,
    isProduction: process.env.NODE_ENV === 'production'
};


