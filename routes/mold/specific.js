const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');

//* ========== Mold Specific List ==========
// Specific Status: { 1: Issue, 2: Wait Approve, 3: Wait Receive, 4: Mold Received, 5: Complete }
router.post('/list', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { Status, month, year } = req.body;
        let moldSpecificList = await pool.request().query(`
        `);
        if(Status){
            let moldSpecificListFiltered = moldSpecificList.recordset.filter(v => v.Status == Status);
            return res.json(moldSpecificListFiltered);
        }

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

        // insert Specific
        let insertSpecific = `INSERT INTO [Mold].[Specification](CustomerID, PartCode, PartName, AxMoldNo, Model, Status, Active)
        VALUES(${CustomerID}, N'${PartCode}', N'${PartName}', '${AxMoldNo}', N'${Model}', 1, 1);

        DECLARE @MoldSpecID INT;
        SET @MoldSpecID = (SELECT SCOPE_IDENTITY());
        INSERT INTO [Mold].[MasterMold](MoldSpecID, Active) VALUES(@MoldSpecID, 0);
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

        if(!DetailID) return res.json([]);
        let moldDetail = await pool.request().query(`SELECT a.MachineSpec, a.ProductSpec, a.MoldSpec,
        a.hvtPicture, a.MoldSpecFile, a.MoldPicture, a.MoldDrawing1, a.MoldDrawing2,
        b.FirstName AS IssueBy, s.IssueTime,
        c.FirstName AS CheckBy, s.CheckTime,
        d.FirstName AS ApproveBy, s.ApproveTime
        FROM [Mold].[SpecificationDetail] a
        LEFT JOIN [Mold].[Specification] s ON s.MoldSpecID = a.MoldSpecID
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = s.IssueBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = s.CheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = s.ApproveBy
        WHERE a.DetailID = ${DetailID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/detail/edit', async (req, res) => { // Update Spec Status = 2(Wait Approve)
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, MachineSpec, ProductSpec, MoldSpec } = req.body;
        let updateSpecDetail = `INSERT INTO [Mold].[SpecificationDetail](MoldSpecID, MachineSpec, ProductSpec, MoldSpec, EditTime,
            MoldPicture, hvtPicture, MoldDrawing1, MoldDrawing2, MoldSpecFile)
        SELECT TOP(1) ${MoldSpecID}, N'${MachineSpec}', N'${ProductSpec}', N'${MoldSpec}', GETDATE(),
        MoldPicture, hvtPicture, MoldDrawing1, MoldDrawing2, MoldSpecFile
        FROM [Mold].[SpecificationDetail] a
        WHERE a.MoldSpecID = ${MoldSpecID}
        ORDER BY a.EditTime DESC;

        UPDATE [Mold].[Specification] SET Status = 2 WHERE MoldSpecID = ${MoldSpecID}; -- Update Status to Wait Approve
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
        let { MoldSpecID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
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
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
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
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
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
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${MoldSpecID}_${DrawingNo}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadMoldDrawing = multer({ storage: storageMoldDrawing }).single('mold_drawing');
router.post('/upload/hvt', async (req, res) => {
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
router.post('/upload/spec', async (req, res) => {
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
                res.json({ message: 'Success', fileName: ImagePath });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
router.post('/upload/mold', async (req, res) => {
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
router.post('/upload/drawing', async (req, res) => {
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
router.post('/sign/issue', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, IssueBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${IssueBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[Specification] SET IssueBy = ${IssueBy}, IssueTime = '${curStr}' WHERE MoldSpecID = ${MoldSpecID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/check', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[Specification] SET CheckBy = ${CheckBy}, CheckTime = '${curStr}' WHERE MoldSpecID = ${MoldSpecID};`;
        await pool.request().query(signRepair);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/approve', async (req, res) => { // Approve => Receive, Update Spec Status = 3(Wait Receive)
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signRepair = `UPDATE [Mold].[Specification] SET ApproveBy = ${ApproveBy}, ApproveTime = '${curStr}', Status = 3 WHERE MoldSpecID = ${MoldSpecID};`;
        await pool.request().query(signRepair);

        // approve => Receive
        // Insert Takeout { TakeoutType = 1(New Mold)}
        let insertReceive = `INSERT INTO [Mold].[MoldTakeout](MoldSpecID, TakeoutType)
        VALUES(${MoldSpecID}, 1);

        DECLARE @TakeoutID INT;
        SET @TakeoutID = (SELECT SCOPE _IDENTITY());
        INSERT INTO [Mold].[MoldReceive](TakeoutID) VALUES(@TakeoutID);
        `;
        await pool.request().query(insertReceive);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Mold Receive Detail ==========
router.post('/receive/detail', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID } = req.body;
        let moldReceive = await pool.request().query(`SELECT a.ReceiveID, a.TakeoutID,
        a.BasicMold, a.DieNo, a.MoldControlNo, a.PartName, a.MaterialGrade, a.GuaranteeShot, a.MoldWeight, a.Cavity,
        a.MoldSize, a.CustomerMoldWarranty, a.MoldType, a.Model,
        a.AppearanceInspect, a.MoldStructure, a.Remark, a.ImagePath,
        b.FirstName AS MoldIssueBy, c.FirstName AS MoldCheckBy, d.FirstName AS MoldApproveBy,
        e.FirstName AS EnCheckBy, f.FirstName AS EnApproveBy
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.MoldIssueBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.MoldCheckBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.MoldApprovBy = d.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON a.EnCheckBy = e.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON a.EnApprovBy = f.EmployeeID
        WHERE a.ReceiveID = ${ReceiveID};
        `);
        let receiveImage = await pool.request().query(`SELECT a.ImageNo, a.ImagePath
        FROM [Mold].[MoldReceiveImage] a
        WHERE a.ReceiveID = ${ReceiveID} AND a.Active = 1;
        `);
        moldReceive.recordset[0].ImagePath = receiveImage.recordset;
        moldReceive.recordset[0].MoldIssueBy = atob(moldReceive.recordset[0].MoldIssueBy || '');
        moldReceive.recordset[0].MoldCheckBy = atob(moldReceive.recordset[0].MoldCheckBy || '');
        moldReceive.recordset[0].MoldApproveBy = atob(moldReceive.recordset[0].MoldApproveBy || '');
        moldReceive.recordset[0].EnCheckBy = atob(moldReceive.recordset[0].EnCheckBy || '');
        moldReceive.recordset[0].EnApproveBy = atob(moldReceive.recordset[0].EnApproveBy || '');

        res.json(moldReceive.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;