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
        let { CustomerID, PartCode, PartName, DrawingRev, Model } = req.body;

        let insertSpecific = `INSERT INTO [Mold].[MoldSpecification](CustomerID, PartCode, PartName, DrawingRev, Model, Active)
        VALUES(${CustomerID}, N'${PartCode}', N'${PartName}', '${DrawingRev}', N'${Model}', 1);
        `;
        await pool.request().query(insertSpecific);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { MoldSpecID, CustomerID, PartCode, PartName, DrawingRev, Model } = req.body;

        let updateSpecific = `UPDATE [Mold].[MoldSpecification] SET CustomerID = ${CustomerID}, PartCode = N'${PartCode}', PartName = N'${PartName}',
        DrawingRev = '${DrawingRev}', Model = N'${Model}' WHERE MoldSpecID = ${MoldSpecID};
        `;
        await pool.request().query(updateSpecific);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { MoldSpecID } = req.body;

        let deleteSpecific = `UPDATE [Mold].[MoldSpecification] SET Active = 0 WHERE MoldSpecID = ${MoldSpecID};
        `;
        await pool.request().query(deleteSpecific);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Mold Specific Detail ==========
router.post('/item/detail', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { MoldSpecID } = req.body;
        let moldDetail = await pool.request().query(`SELECT a.MachineSpec, a.ProductSpec, a.MoldSpec, a.hvtPicture,
        a.MoldSpecFile, a.MoldPicture, a.MoldDrawing1, a.MoldDrawing2
        FROM [Mold].[MoldSpecification] a
        WHERE a.MoldSpeciD = ${MoldSpecID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/item/detail/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { MoldSpecID, MachineSpec, ProductSpec, MoldSpec } = req.body;
        let updateMoldSpec = `UPDATE [Mold].[MoldSpecification] SET MachineSpec = N'${MachineSpec}',
        ProductSpec = N'${ProductSpec}', MoldSpec = N'${MoldSpec}'
        WHERE a.MoldSpeciD = ${MoldSpecID};
        `;
        await pool.request().query(updateMoldSpec);
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
        let { MoldSpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${MoldSpecID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadHVT = multer({ storage: storageHVT }).single('mold_hvt');
//* Spec
const storageMoldSpec = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/spec'),
    filename: (req, file, cb) => {
        let { MoldSpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${MoldSpecID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadMoldSpec = multer({ storage: storageMoldSpec }).single('mold_spec_file');
//* Mold
const storageMoldPicture = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/mold'),
    filename: (req, file, cb) => {
        let { MoldSpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${MoldSpecID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadMoldPicture = multer({ storage: storageMoldPicture }).single('mold_picture');
//* Drawing
const storageMoldDrawing = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/specification/drawing'),
    filename: (req, file, cb) => {
        let { MoldSpecID, DrawingNo } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${MoldSpecID}_${DrawingNo}_${uploadDateStr}` + '.' + ext);
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
                let { MoldSpecID } = req.body;
                let updateHVT = `UPDATE [Mold].[MoldSpecification] SET hvtPicture = N'${ImagePath}' WHERE MoldSpecID = ${MoldSpecID};`;
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
                let { MoldSpecID } = req.body;
                let updateHVT = `UPDATE [Mold].[MoldSpecification] SET MoldSpecFile = N'${ImagePath}' WHERE MoldSpecID = ${MoldSpecID};`;
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
                let { MoldSpecID } = req.body;
                let updateHVT = `UPDATE [Mold].[MoldSpecification] SET MoldPicture = N'${ImagePath}' WHERE MoldSpecID = ${MoldSpecID};`;
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
                let { MoldSpecID, DrawingNo } = req.body;
                let updateDrawing = `UPDATE [Mold].[MoldSpecification] SET MoldDrawing${DrawingNo} = N'${ImagePath}' WHERE MoldSpecID = ${MoldSpecID};`;
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
        let { MoldSpecID, IssueBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${IssueBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[MoldSpecification] SET IssueBy = ${IssueBy}, IssueSignTime = '${curStr}' WHERE MoldSpecID = ${MoldSpecID};`;
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
        let { MoldSpecID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[MoldSpecification] SET CheckBy = ${CheckBy}, CheckSignTime = '${curStr}' WHERE MoldSpecID = ${MoldSpecID};`;
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
        let { MoldSpecID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[MoldSpecification] SET ApproveBy = ${ApproveBy}, ApproveSignTime = '${curStr}' WHERE MoldSpecID = ${MoldSpecID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Mold Receive Detail ==========

module.exports = router;