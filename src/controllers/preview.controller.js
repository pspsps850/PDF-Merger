const {renderPage} = require('../services/pdfPreview.service');
const {httpError} = require('../middleware/errorHandler.middleware');

async function getPagePreview(req, res, next) {
    try {
        const page = Number(req.params.page);

        if (!Number.isInteger(page) || page < 1) {
            throw httpError(400, 'Invalid page number');
        }

        const imagePath = await renderPage(req.params.fileId, page);

        res.type('image/png').sendFile(imagePath);
        
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getPagePreview
};
