const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');
const { getPool } = require('../../middlewares/pool-manager');

//* ========== Declare Multer Store ==========
const storageReceiveImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/receive'),
    filename: (req, file, cb) => {
        const ext = file.mimetype.split('/')[1];
        cb(null, Date.now() + '.' + ext);
    }
});
const uploadReceiveImage = multer({ storage: storageReceiveImage }).single('receive');

const storageReceiveDetailImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/receive_detail'),
    filename: (req, file, cb) => {
        const ext = file.mimetype.split('/')[1];
        cb(null, Date.now() + '.' + ext);
    }
});
const uploadReceiveDetailImage = multer({ storage: storageReceiveDetailImage }).single('receive_detail');

//* ========== Receive List ==========
// TakeoutStatus : { 1: Wait Receive(New Mold), 2: Takeout, 3: Wait EN, 4: Complete }
router.post('/list', async (req, res) => { //TODO: where
    try {
        let pool = await getPool('MoldPool', config);
        let { TakeoutStatus } = req.body;
        let receiveList = await pool.request().query(`
        WITH NewMold AS (
            SELECT c.ReceiveID, b.MoldSpecID, a.MoldID, a.TakeoutType, a.TakeoutStatus, c.BasicMold, c.DieNo, c.MoldControlNo,
            a.IssueTime, a.ReceiveTime, c.MoldApproveBy, c.EnApproveBy
            FROM [Mold].[MoldTakeout] a
            INNER JOIN [Mold].[Specification] b ON b.MoldSpecID = a.MoldSpecID
            LEFT JOIN [Mold].[MoldReceive] c ON c.TakeoutID = a.TakeoutID
            WHERE a.TakeoutType = 1
        ), TakeoutMold AS (
            SELECT b.ReceiveID, a.MoldSpecID, a.MoldID, a.TakeoutType, a.TakeoutStatus, c.BasicMold, c.DieNo, c.MoldControlNo,
            a.IssueTime, a.ReceiveTime, b.MoldApproveBy, b.EnApproveBy
            FROM [Mold].[MoldTakeout] a
            LEFT JOIN [Mold].[MoldReceive] b ON b.TakeoutID = a.TakeoutID
            LEFT JOIN [Mold].[MasterMold] c ON c.MoldID = a.MoldID
            WHERE a.TakeoutType = 2
        ), tbsum AS (
            SELECT * FROM [NewMold]
            UNION ALL
            SELECT * FROM [TakeoutMold]
        )
        SELECT ReceiveID, MoldSpecID, MoldID, TakeoutType AS MoldStatus, TakeoutStatus, BasicMold, DieNo, MoldControlNo,
            IssueTime, ReceiveTime, MoldApproveBy, EnApproveBy
        FROM [tbsum]
        `);
        if (TakeoutStatus) {
            let receiveListFiltered = receiveList.recordset.filter(v => v.TakeoutStatus == TakeoutStatus);
            return res.json(receiveListFiltered);
        }
        res.json(receiveList.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive/item', async (req, res) => { //TODO: BasicMold, DieNo, Qty, Location, Modal Receive
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID } = req.body;
        let receive = await pool.request().query(`SELECT a.ReceiveRemark, a.ReceiveImagePath,
        b.FirstName AS ReceiveBy, a.ReceiveTime
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.ReceiveBy
        WHERE a.ReceiveID = ${ReceiveID};
        `);
        receive.recordset[0].ReceiveBy = atob(receive.recordset[0]?.ReceiveBy || '');
        res.json(receive.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive/item/edit', async (req, res) => { // Modal Receive Edit
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, ReceiveRemark } = req.body;
        let updateReceive = `UPDATE [Mold].[MoldReceive] SET ReceiveRemark = N'${ReceiveRemark}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(updateReceive);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive/item/image/upload', async (req, res) => { // Modal Receive Upload Img
    uploadReceiveImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await getPool('MoldPool', config);
                let { ReceiveID } = req.body;
                let ImagePath = (req.file) ? "/mold/receive/" + req.file.filename : ""
                let updateImagePath = `UPDATE [Mold].[MoldRceive] SET ReceiveImagePath = N'${ImagePath}' WHERE ReceiveID = ${ReceiveID};`;
                await pool.request().query(updateImagePath);

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
router.post('/receive/item/sign/receive', async (req, res) => { // Modal Receive Sign ReceiveBy
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, ReceiveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ReceiveBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signReceive = `UPDATE [Mold].[MoldReceive] SET ReceiveBy = ${ReceiveBy}, ReceiveTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signReceive);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//TODO: ReportNo.
router.post('/takeout', async (req, res) => { // ดูใบ takeout
    try {
        let pool = await getPool('MoldPool', config);
        let { TakeoutID } = req.body;
        let takeout = await pool.request().query(`SELECT a.Remark, a.Note, a.TakeoutImagePath, CarNo,
        b.FirstName AS IssueBy, a.IssueTime,
        c.FirstName AS ApproveBy, a.ApproveTime,
        d.FirstName AS ReceiveBy, r.ReceiveTime
        FROM [Mold].[MoldTakeout] a
        LEFT JOIN [Mold].[MoldReceive] r ON r.TakeoutID = a.TakeoutID
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.IssueBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.ApproveBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON r.ReceiveBy = d.EmployeeID
        WHERE a.TakeoutID = ${TakeoutID};
        `);
        takeout.recordset[0].IssueBy = atob(takeout.recordset[0]?.IssueBy || '');
        takeout.recordset[0].ApproveBy = atob(takeout.recordset[0]?.ApproveBy || '');
        takeout.recordset[0].ReceiveBy = atob(takeout.recordset[0]?.ReceiveBy || '');
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
router.post('/specification/detail/history', async (req, res) => { // ดูอย่างเดียว
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
router.post('/specification/detail', async (req, res) => { // ดูอย่างเดียว
    try {
        let pool = await getPool('MoldPool', config);
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

//* ========== Receive Detail ==========
router.post('/receive/detail', async (req, res) => { //
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID } = req.body;
        let moldReceive = await pool.request().query(`SELECT a.ReceiveID, a.TakeoutID,
        a.BasicMold, a.DieNo, a.MoldControlNo, a.PartName, a.MaterialGrade, a.GuaranteeShot, a.MoldWeight, a.Cavity,
        a.MoldSize, a.MoldType, a.Model, g.TakeoutType AS MoldStatus,
        a.AppearanceInspect, a.MoldStructure, a.Remark,
        b.FirstName AS MoldIssueBy, a.MoldIssueTime,
        c.FirstName AS MoldCheckBy, a.MoldCheckTime,
        d.FirstName AS MoldApproveBy, a.MoldApproveTime,
        e.FirstName AS EnCheckBy, a.EnCheckTime,
        f.FirstName AS EnApproveBy, a.EnApproveTime,
        a.DocumentCtrlNo
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON a.MoldIssueBy = b.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON a.MoldCheckBy = c.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON a.MoldApproveBy = d.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON a.EnCheckBy = e.EmployeeID
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON a.EnApproveBy = f.EmployeeID
        LEFT JOIN [Mold].[MoldTakeout] g ON g.TakeoutID = a.TakeoutID
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
            MoldSize, MoldType, Model, AppearanceInspect, MoldStructure, Remark } = req.body;
        let updateReceive = `UPDATE [Mold].[MoldReceive] SET BasicMold = N'${BasicMold}', DieNo = N'${DieNo}', MoldControlNo = N'${MoldControlNo}',
        PartName = N'${PartName}', MaterialGrade = N'${MaterialGrade}', GuaranteeShot = N'${GuaranteeShot}', MoldWeight = N'${MoldWeight}',
        Cavity = N'${Cavity}', MoldSize = N'${MoldSize}', MoldType = N'${MoldType}',
        Model = N'${Model}', AppearanceInspect = N'${AppearanceInspect.replace("'", '"')}', MoldStructure = N'${MoldStructure.replace("'", '"')}', Remark = N'${Remark}'
        WHERE ReceiveID = ${ReceiveID};
        `;
        await pool.request().query(updateReceive);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive/detail/image/upload', async (req, res) => {
    uploadReceiveDetailImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await getPool('MoldPool', config);
                let { ReceiveID, ImageNo } = req.body;
                let ImagePath = (req.file) ? "/mold/receive_detail/" + req.file.filename : ""
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
        let { ReceiveID, MoldIssueBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${IssueBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signIssue = `UPDATE [Mold].[MoldReceive] SET IssueBy = ${IssueBy}, IssueSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signIssue);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/mold/check', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, MoldCheckBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${CheckBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signCheck = `UPDATE [Mold].[MoldReceive] SET CheckBy = ${CheckBy}, CheckSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signCheck);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/mold/approve', async (req, res) => { // update TakeoutStatus = 3(Wait EN), if New Mold Update Spec Status = 4(Mold Received)
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Mold].[MoldReceive] SET ApproveBy = ${ApproveBy}, ApproveSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};

        DECLARE @TakeoutID INT,
        @TakeoutType INT,
        @MoldSpecID INT;

        -- Set Value
        SELECT @TakeoutID = b.TakeoutID, @TakeoutType = TakeoutType, @MoldSpecID = MoldSpecID
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [Mold].[MoldTakeout] b ON b.TakeoutID = a.TakeoutID
        WHERE ReceiveID = ${ReceiveID};

        -- Update TakeoutStatus = 3(Wait EN)
        UPDATE [Mold].[MoldTakeout] SET TakeoutStatus = 3 WHERE TakeoutID = @TakeoutID;

        -- Check TakeoutType 1: New Mold
        IF(@TakeoutType = 1)
        BEGIN
            UPDATE [Mold].[Specification] SET Status = 4 MoldSpecID = @MoldSpecID;
        END;
        `;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
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
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signCheck = `UPDATE [Mold].[MoldReceive] SET CheckBy = ${CheckBy}, CheckSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};`;
        await pool.request().query(signCheck);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sign/en/approve', async (req, res) => { // update TakeoutStatus = 4(Complete), if New Mold update SpecStatus = 5(Complete), add to Master
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveID, ApproveBy } = req.body;

        let getUser = await pool.request().query(`SELECT UserID, FirstName FROM [TSMolymer_F].[dbo].[User] WHERE EmployeeID = ${ApproveBy};`);
        if (!getUser.recordset.length) return res.status(400).send({ message: 'ขออภัย ไม่พบรหัสพนักงาน' });

        let cur = new Date();
        let curStr = `${cur.getFullYear()}-${('00' + (cur.getMonth() + 1)).substr(-2)}-${('00' + cur.getDate()).substr(-2)} ${('00' + cur.getHours()).substr(-2)}:${('00' + cur.getMinutes()).substr(-2)}`;
        let signApprove = `UPDATE [Mold].[MoldReceive] SET ApproveBy = ${ApproveBy}, ApproveSignTime = '${curStr}' WHERE ReceiveID = ${ReceiveID};

        DECLARE @TakeoutID INT,
        @TakeoutType INT,
        @MoldSpecID INT;

        -- Set Value
        SELECT @TakeoutID = a.TakeoutID, @TakeoutType = TakeoutType, @MoldSpecID = MoldSpecID
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [Mold].[MoldTakeout] b ON b.TakeoutID = a.TakeoutID
        WHERE ReceiveID = ${ReceiveID};

        -- Update TakeoutStatus = 4(Complete)
        UPDATE [Mold].[MoldTakeout] SET TakeoutStatus = 4 WHERE TakeoutID = @TakeoutID;

        -- Check TakeoutType 1: New Mold
        IF(@TakeoutType = 1)
        BEGIN
            UPDATE [Mold].[Specification] SET Status = 5 MoldSpecID = @MoldSpecID;

            INSERT INTO [Mold].[MasterMold](MoldControlNo, BasicMold, DieNo, MoldName, CustomerID, Cavity, RawMaterial, ReceivedDate, MoldSpecID, Status, Active)
            SELECT a.MoldControlNo, a.BasicMold, a.DieNo, a.PartName, c.CustomerID, a.Cavity, a.MaterialGrade, a.ReceiveTime, b.MoldSpecID, 1, 1
            FROM [Mold].[MoldReceive] a
            LEFT JOIN [Mold].[MoldTakeout] b ON b.TakeoutID = a.TakeoutID
            LEFT JOIN [Mold].[Specification] c ON c.MoldSpecID = b.MoldSpecID
            WHERE a.ReceiveID = ${ReceiveID};
        END;
        `;
        await pool.request().query(signApprove);

        res.json({ message: 'Success', Username: !getUser.recordset.length ? null : atob(getUser.recordset[0].FirstName), SignTime: curStr });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router

//* Receive Status
// 1: Wait Receive => มาจาก New Mold หลังจาก EN Approve Specification
// 2: Takeout => หลังจากกด Takeout
// 3: Wait EN => หลังจาก Mold Approve Receive
// 4: Complete => หลังจาก Engineer Approve Receive