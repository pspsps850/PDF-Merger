function log(level, message, meta){
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${level}: ${message}`;
    
    if (level === 'ERROR') {
        console.error(line ,meta ?? '');
    }

    if(level === 'WARN'){
        console.warn(line ,meta ?? '');
    }

    console.log(line);
}

module.exports = {
    info: (message, meta) => log('INFO', message, meta),
    warn: (message, meta) => log('WARN', message, meta),
    error: (message, meta) => log('ERROR', message, meta)
};
