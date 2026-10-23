const logger = require('../utils/logger.utils');
const {isProduction} = require('../configs/env.config');

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function notFound(req, res, next) {
   next(httpError(404, `Resource not found: ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
    let status =err.statusCode || 500;

    if(err.name === 'MulterError'){
        status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    }

    if(status >= 500){
        logger.error(err.message, err);
    }else{
        logger.warn(err.message);
    }

    const safeMessage = 
    status >= 500 ? 'Internal server error' : err.message || 'Internal server error';

    if(res.headersSent){
        return next(err);
    }

    res.status(status).json({
        success: false,
        error: safeMessage,
        stack: isProduction ? null : err.stack
    });
}

module.exports = {
    httpError,
    notFound,
    errorHandler
};