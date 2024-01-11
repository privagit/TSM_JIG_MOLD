const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');

router.post('/', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let item = await pool.request().query(`
        `);
        res.json(item.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Jig Creation ==========
router.post('/list', async (req, res) => { //TODO: FinishDate, Status, PartList, TrialCount, Evaluation
    try {
        let pool = await sql.connect(config);
        let { RequestSection, Status } = req.body;
        let jigCreateList = await pool.request().query(`SELECT a.JigCreationID, NULL AS JigNo, a.CustomerID, b.CustomerName, a.PartCode, a.PartName, a.RequestSection, 
        CONVERT(NVARCHAR, a.RequestDate, 23) AS RequestDate, CONVERT(NVARCHAR, a.RequiredDate, 23) AS RequiredDate,
        a.Quatity, a.JigTypeID, c.JigType, a.RequestType, a.Budget, a.CustomerBudget
        FROM [Jig].[JigCreation] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [Jig].[MasterJigType] c ON c.JigTypeID = a.JigTypeID
        `);
        res.json(jigCreateList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageJigRequestImage = multer.diskStorage({
    destination: path.join(__dirname, '../public/jig/request'),
    filename: (req, file, cb) => {
        let { JigID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${JigID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadJigRequestImage = multer({ storage: storageJigRequestImage }).single('jig_request_image');
router.post('/issue', async (req, res) => {
    uploadJigRequestImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let RequestImagePath = (req.file) ? "/jig/request/" + req.file.filename : "";
                let { CustomerID, JigTypeID, PartCode, PartName, RequiredDate, RequestTime, Quantity, RequestSection, RequestType,
                    ProductionDate, Budget, CustomerBudget, FgMonthQty, FgYearQty, UseIn, Requirement } = req.body;
                let insertJigCreate = await pool.request().query(`INSERT INTO [Jig].[JigCreation](CustomerID, JigTypeID, PartCode, PartName,
                    RequiredDate, RequestTime, Quantity, RequestSection, RequestType,
                    ProductionDate, Budget, CustomerBudget, FgMonthQty, FgYearQty, UseIn, Requirement, RequestImagePath)
                    VALUES(${CustomerID}, ${JigTypeID}, N'${PartCode}', N'${PartName}',
                    '${RequiredDate}', '${RequestTime}', ${Quantity}, ${RequestSection}, ${RequestType},
                    '${ProductionDate}', ${Budget}, ${CustomerBudget}, ${FgMonthQty}, ${FgYearQty}, ${UseIn}, N'${Requirement}', '${RequestImagePath}'
                    );
                `);
                await pool.request().query(insertJigCreate);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})

//* ===== Request Jig =====
router.post('/request', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigCreationID } = req.body;
        let jigCreateList = await pool.request().query(`
        `);
        res.json(jigCreateList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ===== Part List =====



//* ===== Work List =====



//* ===== Modify Jig =====



//* ===== Trial =====



//* ===== Evaluation =====



//* ===== Comment =====
