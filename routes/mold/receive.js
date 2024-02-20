const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const { getPool } = require('../../middlewares/pool-manager');

//* ========== Receive List ==========
router.post('/list', async (req, res) => { //TODO: Status, where
    try {
        let pool = await getPool('MoldPool', config);
        let { Status } = req.body;
        let receiveList = await pool.request().query(`
        WITH NewMold AS (
            SELECT c.MoldReceiveID, b.MoldSpecID, a.MoldID, a.TakeoutType, a.TakeoutStatus, c.BasicMold, c.DieNo, c.MoldControlNo,
            a.IssueTime, a.ReceiveTime, c.MoldApprovBy, c.EnApprovBy
            FROM [Mold].[MoldTakeout] a
            INNER JOIN [Mold].[Specification] b ON b.MoldSpecID = a.MoldSpecID
            LEFT JOIN [Mold].[MoldReceive] c ON c.TakeoutID = a.TakeoutID
            WHERE a.TakeoutType = 1
        ), TakeoutMold AS (
            SELECT b.MoldReceiveID, a.MoldSpecID, a.MoldID, a.TakeoutType, a.TakeoutStatus, c.BasicMold, c.DieNo, c.MoldControlNo,
            a.IssueTime, a.ReceiveTime, b.MoldApprovBy, b.EnApprovBy
            FROM [Mold].[MoldTakeout] a
            LEFT JOIN [Mold].[MoldReceive] b ON b.TakeoutID = a.TakeoutID
            LEFT JOIN [Mold].[MasterMold] c ON c.MoldID = a.MoldID
            WHERE a.TakeoutType = 2
        ), tbsum AS (
            SELECT * FROM [NewMold]
            UNION ALL
            SELECT * FROM [TakeoutMold]
        )
        SELECT MoldReceiveID, MoldSpecID, MoldID, TakeoutType, TakeoutStatus, BasicMold, DieNo, MoldControlNo,
            IssueTime, ReceiveTime, MoldApprovBy, EnApprovBy
        FROM [tbsum]
        `);
        res.json(receiveList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive', async (req, res) => { //! ???
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID, MoldID } = req.body;

    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/takeout', async (req, res) => { //TODO: CarNo.
    try {
        let pool = await getPool('MoldPool', config);
        let { TakeoutID } = req.body;
        let takeout = await pool.request().query(`SELECT a.Remark, a.Note, a.TakeoutImagePath,
        b.FirstName AS IssueBy, c.FirstName AS ApproveBy, d.FirstName AS ReceiveBy
        FROM [Mold].[MoldTakeout] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.IssueBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.ApproveBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.ReceiveBy = d.EmployeeID
        WHERE a.TakeoutID = ${TakeoutID};
        `);
        // let { MoldID, TakeoutDate, Loation, Remark, Note } = req.body;
        // let insertTakeout = `INSERT INTO [Mold].[MoldTakeout](MoldID, TakeoutDate, Location, Remark, Note)
        // VALUES(${MoldID}, '${TakeoutDate}', N'${Loation}', N'${Remark}', N'${Note}');

        // DECLARE @TakeoutID INT;
        // SET @TakeoutID = (SELECT SCOPE_IDENTITY());
        // INSERT INTO [Mold].[MoldReceive](TakeoutID) VALUES(@TakeoutID);
        // `;
        // await pool.request().query(insertTakeout);
        res.json(takeout.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Specification Detail ==========
router.post('/specification/detail/history', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        let moldDetail = await pool.request().query(`SELECT c.DetailID, c.EditTime
        FROM [Mold].[MasterMold] a
        LEFT JOIN [Mold].[Specification] b ON b.MoldSpecID = a.MoldSpecID
        LEFT JOIN [Mold].[SpecificationDetail] c ON c.MoldSpecID = c.MoldSpecID
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/specification/detail', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { DetailID } = req.body;
        let moldDetail = await pool.request().query(`SELECT a.MachineSpec, a.ProductSpec, a.MoldSpec,
        a.hvtPicture, a.MoldSpecFile, a.MoldPicture, a.MoldDrawing1, a.MoldDrawing2,
        b.FirstName AS IssueBy, a.IssueSignTime,
        c.FirstName AS CheckBy, a.CheckSignTime,
        d.FirstName AS ApproveBy, a.ApproveSignTime
        FROM [Mold].[SpecificationDetail] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.IssueBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.CheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = a.ApproveBy
        WHERE a.DetailID = ${DetailID};
        `);
        res.json(moldDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Receive Detail ==========
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
router.post('/receive/detail/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, BasicMold, DieNo, MoldControlNo, PartName, MaterialGrade, GuaranteeShot, MoldWeight, Cavity,
            MoldSize, CustomerMoldWarranty, MoldType, Model, AppearanceInspect, MoldStructure, Remark } = req.body;
        let updateReceive = `UPDATE [Mold].[Receive] SET BasicMold = N'${BasicMold}', DieNo = N'${DieNo}', MoldControlNo = N'${MoldControlNo}',
        PartName = N'${PartName}', MaterialGrade = N'${MaterialGrade}', GuaranteeShot = N'${GuaranteeShot}', MoldWeight = N'${MoldWeight}',
        Cavity = N'${Cavity}', MoldSize = N'${MoldSize}', CustomerMoldWarranty = N'${CustomerMoldWarranty}', MoldType = N'${MoldType}',
        Model = N'${Model}', AppearanceInspect = N'${AppearanceInspect}', MoldStructure = N'${MoldStructure}', Remark = N'${Remark}'
        WHERE ReceiveID = ${ReceiveID};
        `;
        await pool.request().query(updateReceive);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

const storageReceiveImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/receive'),
    filename: (req, file, cb) => {
        const ext = file.mimetype.split('/')[1];
        cb(null, Date.now() + '.' + ext);
    }
});
const uploadReceiveImage = multer({ storage: storageReceiveImage }).single('receive');
router.post('/receive/detail/image/upload', async (req, res) => {
    uploadReceiveImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await getPool('MoldPool', config);
                let { ReceiveID, ImageNo } = req.body;
                let ImagePath = (req.file) ? "/mold/receive/" + req.file.filename : ""
                // ImageNo 0-7
                let insertImage = `UPDATE [Mold].[MoldRceiveImage] SET Active = 0 WHERE ReceiveID = ${ReceiveID} AND ImageNo = ${ImageNo};
                INSERT INTO [Mold].[MoldReceiveImage] (ReceiveID, ImageNo, ImagePath, Active) VALUES(${ReceiveID}, ${ImageNo}, '${ImagePath}', 1);
                `;
                await pool.request().query(insertImage);

                res.header('Access-Control-Allow-Origin', req.headers.origin);
                res.header('Access-Control-Allow-Credentials', true);
                res.status(200).send({ message: 'Success Upload File' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})

router.post('/sign/mold/issue', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, IssueBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${IssueBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signIssue = `UPDATE [Mold].[MoldReceive] SET IssueBy = ${IssueBy}, IssueSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signIssue);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/mold/check', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signCheck = `UPDATE [Mold].[MoldReceive] SET CheckBy = ${CheckBy}, CheckSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signCheck);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/mold/approve', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Mold].[MoldReceive] SET ApproveBy = ${ApproveBy}, ApproveSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signApprove);

        

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/en/check', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, CheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signCheck = `UPDATE [Mold].[MoldReceive] SET CheckBy = ${CheckBy}, CheckSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signCheck);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/en/approve', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if(!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00'+(cur.getMonth()+1)).substr(-2)}-${('00'+cur.getDate()).substr(-2)} ${('00'+cur.getHours()).substr(-2)}:${('00'+cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Mold].[MoldReceive] SET ApproveBy = ${ApproveBy}, ApproveSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length? null: atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})



module.exports = router