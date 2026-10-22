const {PORT} = require('./src/config/env.config');
const express = require('express');
const app = require('./src/app');
const logger = require('./src/utils/logger.utils');

const server = app.listen(PORT, ()=>{
    logger.info(`Server running on port ${PORT}`);
});

function shutdown(signal){
    logger.info(`${signal} received, shutting down server...`);

    server.close((err) => {
        if (err) {
            logger.error(err);
            process.exit(1);
        }
        logger.info('Server closed');
        process.exit(0);
    });

    setTimeout(()=>{
        logger.warn('Forcing shutdown');
        process.exit(1);
    }, 5000).unref();
}

process.on('sigint', () => shutdown('SIGINT'));
process.on('sigterm', () => shutdown('SIGTERM'));


// app.listen(PORT, () => {
//     logger.info(`Server running on port ${PORT}`);
// });