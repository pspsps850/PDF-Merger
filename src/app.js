const express = require('express');
const helmet = require('helmet');
const path = require('path');

const routes = require('./routes/index.routes');
const {errorHandler, notFound} = require('./middleware/errorHandler.middleware');
const {ensureTmpDirs, startTempSweeper } = require('./utils/file.utils');
const jobService = require('./services/job.service');
const {TMP_TTL_HOURS} = require('./configs/env.config');
const logger = require('./utils/logger.utils');

try{
    ensureTmpDirs();
}catch(err){
    logger.error('Failed to ensure temporary directories:', err);
}

startTempSweeper(TMP_TTL_HOURS, 15);
jobService.startJobSweeper(TMP_TTL_HOURS, 30);
 
const app = express();

app.disable('x-powered-by');

app.use(express.json({
    limit: '5mb'
}));

app.use(
    express.static(path.join(__dirname, 'public'),{
        extensions: ['html', 'htm']
    })
);

app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;



