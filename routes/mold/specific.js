const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');

//* ========== Mold Specific List ==========
router.post('/list', async (req, res) => { //TODO:
    try {
        let pool = await sql.connect(config);
        let { Status } = req.body;

        let moldSpecificList = await pool.request().query(`
        `);

        res.json(moldSpecificList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { CustomerID, PartCode, PartName, AxMoldNo, Model } = req.body;

        let insertSpecific = `INSERT INTO [Mold].[Specification](CustomerID, PartCode, PartName, AxMoldNo, Model, Active)
        VALUES(${CustomerID}, N'${PartCode}', N'${PartName}', '${AxMoldNo}', N'${Model}', 1);
        `;
        await pool.request().query(insertSpecific);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpecID } = req.body;
        let deleteSpecific = `UPDATE [Mold].[Specification] SET Active = 0 WHERE SpecID = ${SpecID};`;
        await pool.request().query(deleteSpecific);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Mold Specific Detail ==========
router.post('/detail/history', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpecID } = req.body;
        let moldDetail = await pool.request().query(`SELECT DetailID, EditTime
        FROM [Mold].[SpecificationDetail]
        WHERE SpecID = ${SpecID}
        ORDER BY EditTime DESC;
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/detail', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DetailID } = req.body;
        let moldDetail = await pool.request().query(`SELECT a.MachineSpec, a.ProductSpec, a.MoldSpec,
        a.hvtPicture, a.MoldSpecFile, a.MoldPicture, a.MoldDrawing1, a.MoldDrawing2,
        b.FirstName AS IssueBy, a.IssueSignTime,
        c.FirstName AS CheckBy, a.CheckSignTime,
        d.FirstName AS ApproveBy, a.ApproveSignTime
        FROM [Mold].[SpecificationDetail] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmpployeeID = a.IssueBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmpployeeID = a.CheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmpployeeID = a.ApproveBy
        WHERE a.DetailID = ${DetailID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/detail/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpecID, MachineSpec, ProductSpec, MoldSpec } = req.body;
        let updateSpecDetail = `INSERT INTO [Mold].[SpecificationDetail](SpecID, MachineSpec, ProductSpec, MoldSpec, EditTime)
        VALUES(${SpecID}, N'${MachineSpec}', N'${ProductSpec}', N'${MoldSpec}', GETDATE());
        `;
        await pool.request().query(updateSpecDetail);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ===== Upload =====
//* HVT
const storageHVT = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/hvt'),
    filename: (req, file, cb) => {
        let { SpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${SpecID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadHVT = multer({ storage: storageHVT }).single('mold_hvt');
//* Spec
const storageMoldSpec = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/spec'),
    filename: (req, file, cb) => {
        let { SpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${SpecID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadMoldSpec = multer({ storage: storageMoldSpec }).single('mold_spec_file');
//* Mold
const storageMoldPicture = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/mold'),
    filename: (req, file, cb) => {
        let { SpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${SpecID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadMoldPicture = multer({ storage: storageMoldPicture }).single('mold_picture');
//* Drawing
const storageMoldDrawing = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/drawing'),
    filename: (req, file, cb) => {
        let { SpecID, DrawingNo } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${SpecID}_${DrawingNo}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadMoldDrawing = multer({ storage: storageMoldDrawing }).single('mold_drawing');
router.post('/item/upload/hvt', async (req, res) => {
    uploadHVT(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/mold/specification/hvt/" + req.file.filename : "";
                let { DetailID } = req.body;
                let updateHVT = `UPDATE [Mold].[SpecificationDetail] SET hvtPicture = N'${ImagePath}' WHERE DetailID = ${DetailID};`;
                await pool.request().query(updateHVT);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
router.post('/item/upload/spec', async (req, res) => {
    uploadMoldSpec(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/mold/specification/spec/" + req.file.filename : "";
                let { DetailID } = req.body;
                let updateHVT = `UPDATE [Mold].[SpecificationDetail] SET MoldSpecFile = N'${ImagePath}' WHERE DetailID = ${DetailID};`;
                await pool.request().query(updateHVT);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
router.post('/item/upload/mold', async (req, res) => {
    uploadMoldPicture(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/mold/specification/mold/" + req.file.filename : "";
                let { DetailID } = req.body;
                let updateHVT = `UPDATE [Mold].[SpecificationDetail] SET MoldPicture = N'${ImagePath}' WHERE DetailID = ${DetailID};`;
                await pool.request().query(updateHVT);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
router.post('/item/upload/drawing', async (req, res) => {
    uploadMoldDrawing(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/mold/specification/drawing/" + req.file.filename : "";
                let { DetailID, DrawingNo } = req.body;
                let updateDrawing = `UPDATE [Mold].[SpecificationDetail] SET MoldDrawing${DrawingNo} = N'${ImagePath}' WHERE DetailID = ${DetailID};`;
                await pool.request().query(updateDrawing);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})

//* ===== Sign =====
router.post('/item/sign/issue', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DetailID, IssueBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${IssueBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[SpecificationDetail] SET IssueBy = ${IssueBy}, IssueSignTime = '${curStr}' WHERE DetailID = ${DetailID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/item/sign/check', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DetailID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[SpecificationDetail] SET CheckBy = ${CheckBy}, CheckSignTime = '${curStr}' WHERE DetailID = ${DetailID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/item/sign/approve', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DetailID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[SpecificationDetail] SET ApproveBy = ${ApproveBy}, ApproveSignTime = '${curStr}' WHERE DetailID = ${DetailID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Mold Receive Detail ==========

module.exports = router;