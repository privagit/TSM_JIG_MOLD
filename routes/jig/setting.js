const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_jig;
const sql = require('mssql');
const multer = require('multer');
const path = require('path');


//* ========== Jig Setting ==========
// Jig
router.post('/jig', async (req, res) => { //TODO: UseIn
    try {
        let pool = await sql.connect(config);
        let jig = await pool.request().query(`
        SELECT a.JigID, a.JigTypeID, b.JigType, a.CustomerID, c.CustomerName, a.JigNo,
        a.PartCode, a.PartName, a.ToolingNo, a.Section, a.Active, a.Location, a.Status,
        a.Asset, a.Revision
        FROM [Jig].[MasterJig] a
        LEFT JOIN [Jig].[MasterJigType] b ON b.JigTypeID = a.JigTypeID AND b.Active = 1
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] c ON c.CustomerID = a.CustomerID
        `);
        res.json(jig.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/jig/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigID, PartCode, PartName, Asset, Location, Status } = req.body;
        let updateJig = `UPDATE [Jig].[MasterJig] SET PartCode = N'${PartCode}', PartName = N'${PartName}', Asset = N'${Asset}',
        Location = N'${Location}', Status = ${Status}
        WHERE JigID = ${JigID};
        `;
        await pool.request().query(updateJig);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Jig Type
router.post('/jig/type', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let jigType = await pool.request().query(`
        SELECT JigTypeID, JigType
        FROM [Jig].[MasterJigType]
        WHERE Active = 1;
        `);
        res.json(jigType.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/jig/type/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigType } = req.body;
        let insertJigType = `INSERT INTO [Jig].[MasterJigType](JigType, Active)
        VALUES(N'${JigType}', 1);
        `;
        await pool.request().query(insertJigType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/jig/type/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigTypeID, JigType } = req.body;
        let updateJigType = `UPDATE [Jig].[MasterJigType] SET JigType = N'${JigType}'
        WHERE JigTypeID = ${JigTypeID};
        `;
        await pool.request().query(updateJigType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/jig/type/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigTypeID } = req.body;
        let deleteJigType = `UPDATE [Jig].[MasterJigType] SET Active = 0 WHERE JigTypeID = ${JigTypeID};`;
        await pool.request().query(deleteJigType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Creation ==========
// Evaluation Topic
router.post('/evaluation/topic', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let evalTopic = await pool.request().query(`
        SELECT a.EvalTopicID, a.EvalTopic
        FROM [Jig].[MasterEvalTopic] a
        WHERE a.Active = 1;
        `);
        res.json(evalTopic.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/topic/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalTopic } = req.body;
        let insertEvalTopic = `INSERT INTO [Jig].[MasterEvalTopic](EvalTopic, Active)
        VALUES(N'${EvalTopic}', 1);
        `;
        await pool.request().query(insertEvalTopic);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/topic/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalTopicID, EvalTopic } = req.body;
        let updateEvalTopic = `UPDATE [Jig].[MasterEvalTopic] SET EvalTopic = N'${EvalTopic}'
        WHERE EvalTopicID = ${EvalTopicID};
        `;
        await pool.request().query(updateEvalTopic);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/evaluation/topic/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalTopicID } = req.body;
        let deleteEvalTopic = `UPDATE [Jig].[MasterEvalTopic] SET Active = 0 WHERE EvalTopicID = ${EvalTopicID};`;
        await pool.request().query(deleteEvalTopic);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Evaluation Detail
router.post('/evaluation/detail', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalTopicID } = req.body;
        let evalDetail = await pool.request().query(`
        SELECT a.EvalDetailID, a.EvalTopicID, a.EvalDetail
        FROM [Jig].[MasterEvalDetail] a
        WHERE a.EvalTopicID = ${EvalTopicID} AND a.Active = 1;
        `);
        res.json(evalDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/detail/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalTopicID, EvalDetail } = req.body;
        let insertEvalDetail = `INSERT INTO [Jig].[MasterEvalDetail](EvalTopicID, EvalDetail, Active)
        VALUES(${EvalTopicID}, N'${EvalDetail}', 1);
        `;
        await pool.request().query(insertEvalDetail);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/detail/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalDetailID, EvalDetail } = req.body;
        let updateEvalDetail = `UPDATE [Jig].[MasterEvalDetail] SET EvalDetail = N'${EvalDetail}'
        WHERE EvalDetailID = ${EvalDetailID};
        `;
        await pool.request().query(updateEvalDetail);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/evaluation/detail/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalDetailID } = req.body;
        let deleteEvalDetail = `UPDATE [Jig].[MasterEvalDetail] SET Active = 0 WHERE EvalDetailID = ${EvalDetailID};`;
        await pool.request().query(deleteEvalDetail);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Evaluation Criteria
router.post('/evaluation/criteria', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalDetailID } = req.body;
        let evalCriteria = await pool.request().query(`
        SELECT a.EvalCriteriaID, a.EvalDetailID, a.EvalCriteria
        FROM [Jig].[MasterEvalCriteria] a
        WHERE a.EvalDetailID = ${EvalDetailID} AND a.Active = 1;
        `);
        res.json(evalCriteria.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/evaluation/criteria/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalDetailID, EvalCriteria } = req.body;
        let insertEvalCriteria = `INSERT INTO [Jig].[MasterEvalCriteria](EvalDetailID, EvalCriteria, Active)
        VALUES(${EvalDetailID}, N'${EvalCriteria}', 1);
        `;
        await pool.request().query(insertEvalCriteria);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/evaluation/criteria/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalCriteriaID, EvalCriteria } = req.body;
        let updateEvalCriteria = `UPDATE [Jig].[MasterEvalCriteria] SET EvalCriteria = N'${EvalCriteria}'
        WHERE EvalCriteriaID = ${EvalCriteriaID};
        `;
        await pool.request().query(updateEvalCriteria);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/evaluation/criteria/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { EvalCriteriaID } = req.body;
        let deleteEvalCriteria = `UPDATE [Jig].[MasterEvalCriteria] SET Active = 0 WHERE EvalCriteriaID = ${EvalCriteriaID};`;
        await pool.request().query(deleteEvalCriteria);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Daily & Torque ==========
// Torque
router.post('/torque/check', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigID } = req.body;
        let torqueCheck = await pool.request().query(`
        SELECT a.TorqueCheckID, a.JigID, a.TorqueNo, a.Spec, a.UseScrew,
        a.ToleranceMin, a.ToleranceMax, a.Model, a.ProcessFileNo
        FROM [Jig].[MasterTorqueCheck] a
        WHERE a.JigID = ${JigID};
        `);
        res.json(torqueCheck.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/torque/check/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigID, TorqueNo, Spec, ToleranceMin, ToleranceMax, Model, ProcessFileNo, UseScrew } = req.body;
        let updateTorqueCheck = `
        DECLARE @TorqueCheckID INT;
        SET @TorqueCheckID = (SELECT TorqueCheckID FROM [Jig].[MasterTorqueCheck] WHERE JigID = ${JigID});

        IF(@TorqueCheckID IS NULL) -- Insert
        BEGIN
            INSERT INTO [Jig].[MasterTorqueCheck](JigID, TorqueNo, Spec, ToleranceMin, ToleranceMax, Model, ProcessFileNo, UseScrew)
            VALUES(${JigID}, N'${TorqueNo}', ${Spec}, ${ToleranceMin}, ${ToleranceMax}, N'${Model}', N'${ProcessFileNo}', N'${UseScrew}');
        END
        ELSE -- Update
        BEGIN
            UPDATE [Jig].[MasterTorqueCheck] SET TorqueNo = N'${TorqueNo}', Spec = ${Spec}, ToleranceMin = ${ToleranceMin}, ToleranceMax = ${ToleranceMax},
            Model = N'${Model}', ProcessFileNo = N'${ProcessFileNo}', UseScrew = N'${UseScrew}'
            WHERE TorqueCheckID = @TorqueCheckID;
        END
        `;
        await pool.request().query(updateTorqueCheck);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Daily CheckPoint
router.post('/daily/checkpoint', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigID } = req.body;
        let dailyCheckpoint = await pool.request().query(`
        SELECT a.DailyCheckPointID, a.JigID, a.DailyCheckPoint, a.DailyCheckPointNo
        FROM [Jig].[MasterDailyCheckPoint] a
        WHERE a.JigID = ${JigID} AND a.Active = 1
        ORDER BY DailyCheckPointNo;
        `);
        res.json(dailyCheckpoint.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/daily/checkpoint/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigID, DailyCheckPoint, DailyCheckPointNo } = req.body;
        let insertDailyCheckpoint = `INSERT INTO [Jig].[MasterDailyCheckPoint](JigID, DailyCheckPoint, DailyCheckPointNo, Active)
        VALUES(${JigID}, N'${DailyCheckPoint}', ${DailyCheckPointNo}, 1);
        `;
        await pool.request().query(insertDailyCheckpoint);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/daily/checkpoint/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DailyCheckPointID, DailyCheckPoint, DailyCheckPointNo } = req.body;
        let updateDailyCheckpoint = `UPDATE [Jig].[MasterDailyCheckPoint] SET DailyCheckPoint = N'${DailyCheckPoint}', DailyCheckPointNo = ${DailyCheckPointNo}
        WHERE DailyCheckPointID = ${DailyCheckPointID};
        `;
        await pool.request().query(updateDailyCheckpoint);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/daily/checkpoint/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DailyCheckPointID } = req.body;
        let deleteDailyCheckpoint = `UPDATE [Jig].[MasterDailyCheckPoint] SET Active = 0 WHERE DailyCheckPointID = ${DailyCheckPointID};`;
        await pool.request().query(deleteDailyCheckpoint);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Daily CheckPoint Detail
router.post('/daily/checkpoint/detail', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DailyCheckPointID } = req.body;
        let dailyCheckpointDetail = await pool.request().query(`
        SELECT a.DailyCheckDetailID, a.DailyCheckDetail, a.DailyCheckDetailNo
        FROM [Jig].[MasterDailyCheckDetail] a
        WHERE a.DailyCheckPointID = ${DailyCheckPointID} AND Active = 1
        ORDER BY DailyCheckDetailNo ;
        `);
        res.json(dailyCheckpointDetail.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/daily/checkpoint/detail/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DailyCheckPointID, DailyCheckDetail, DailyCheckDetailNo } = req.body;
        let insertDailyCheckpointDetail = `INSERT INTO [Jig].[MasterDailyCheckDetail](DailyCheckPointID, DailyCheckDetail, DailyCheckDetailNo, Active)
        VALUES(${DailyCheckPointID}, N'${DailyCheckDetail}', ${DailyCheckDetailNo}, 1);
        `;
        await pool.request().query(insertDailyCheckpointDetail);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/daily/checkpoint/detail/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DailyCheckDetailID, DailyCheckDetail, DailyCheckDetailNo } = req.body;
        let updateDailyCheckpointDetail = `UPDATE [Jig].[MasterDailyCheckDetail] SET DailyCheckDetail = N'${DailyCheckDetail}', DailyCheckDetailNo = ${DailyCheckDetailNo}
        WHERE DailyCheckDetailID = ${DailyCheckDetailID};
        `;
        await pool.request().query(updateDailyCheckpointDetail);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/daily/checkpoint/detail/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DailyCheckDetailID } = req.body;
        let deleteDailyCheckpointDetail = `UPDATE [Jig].[MasterDailyCheckDetail] SET Active = 0 WHERE DailyCheckDetailID = ${DailyCheckDetailID};`;
        await pool.request().query(deleteDailyCheckpointDetail);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Maintenace ==========
// Maintenance
const storagePmImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/pm_checkfile'),
    filename: (req, file, cb) => {
        let { JigID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${JigID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadPmImage = multer({ storage: storagePmImage }).single('pm_checkfile');

router.post('/maintenace', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { JigID } = req.body;
        let maintenance = await pool.request().query(`SELECT a.PmID, a.JigID, a.Week, a.ImagePath, a.PmTopic
        FROM [Jig].[MasterPm] a
        WHERE JigID = ${JigID};
        `);
        res.json(maintenance.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/pm/edit', async (req, res) => { // edit PM Week
    try {
        let pool = await sql.connect(config);
        let { JigID, Week } = req.body;
        let updatePm = `DECLARE @PmID INT;
        SET @PmID = (SELECT PmID FROM [Jig].[MasterPm] WHERE JigID = ${JigID});

        IF(@PmID IS NULL) -- Insert
        BEGIN
            INSERT INTO [Jig].[MasterPm](JigID, Week) VALUES(${JigID}, ${Week});
        END
        ELSE -- Update
        BEGIN
            UPDATE [Jig].[MasterPm] SET Week = ${Week} WHERE PmID = @PmID;
        END;
        `;
        await pool.request().query(updatePm);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/pm/checkfile/upload', async (req, res) => { // Upload PM Checkfile Image
    uploadPmImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let ImagePath = (req.file) ? "/jig/pm_checkfile/" + req.file.filename : "";
                let { JigID } = req.body;
                let updatePmCheckfile = `DECLARE @PmID INT;
                SET @PmID = (SELECT PmID FROM [Jig].[MasterPm] WHERE JigID = ${JigID});

                IF(@PmID IS NULL) -- Insert
                BEGIN
                    INSERT INTO [Jig].[MasterPm](JigID, ImagePath) VALUES(${JigID}, '${ImagePath}');
                END
                ELSE -- Update
                BEGIN
                    UPDATE [Jig].[MasterPm] SET ImagePath = '${ImagePath}' WHERE PmID = @PmID;
                END;
                `;
                await pool.request().query(updatePmCheckfile);
                res.json({ message: 'Success' });
            } catch (err) {
                console.log(req.url, 'DB ERROR', err);
                res.status(500).send({ message: `${err}` });
            }
        }
    })
})
router.put('/maintenace/inspect/edit', async (req, res) => { //TODO:  uncheck, select PM Topic to use
    try {
        let pool = await sql.connect(config);
        let { JigID, PmTopicID } = req.body;
        let getJigInspect = await pool.request().query(`SELECT PmID, JigID, PmTopic FROM [Jig].[MasterPm] WHERE JigID = ${JigID};`);
        if(getJigInspect.recordset.length){
            let PmID = getJigInspect.recordset[0].PmID;
            let PmTopic = JSON.parse(getJigInspect.recordset[0].PmTopic).push(PmTopicID);
            let updateJigInspect = `UPDATE [Jig].[MasterPm] SET PmTopic = N'${PmTopic}' WHERE PmID = ${PmID};`;
            await pool.request().query(updateJigInspect);
        } else {
            let insertJigInspect = `INSERT INTO [Jig].[MasterPm](JigID, PmTopic) VALUES(${JigID}, N'[${PmTopicID}]');`;
            await pool.request().query(insertJigInspect);
        }
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// PM Topic
router.post('/maintenace/pm/topic', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let pmTopic = await pool.request().query(`
        SELECT a.PmTopicID, a.Topic, a.TopicType, a.StandardValue
        FROM [Jig].[MasterPmTopic] a
        WHERE a.Active = 1;
        `);
        res.json(pmTopic.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/pm/topic/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { Topic, TopicType, StandardValue } = req.body;
        let insertInspection = `INSERT INTO [Jig].[MasterPmTopic](Topic, TopicType, StandardValue, Active)
        VALUES(N'${Topic}', ${TopicType}, ${StandardValue}, 1);
        `;
        await pool.request().query(insertInspection);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/maintenace/pm/topic/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { PmTopicID, Topic, TopicType, StandardValue } = req.body;
        let updatePmTopic = `UPDATE [Jig].[MasterPmTopic] SET Topic = N'${Topic}', TopicType = ${TopicType}, StandardValue = ${StandardValue}
        WHERE PmTopicID = ${PmTopicID};
        `;
        await pool.request().query(updatePmTopic);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/maintenace/pm/topic/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { PmTopicID } = req.body;
        let deletePmTopic = `UPDATE [Jig].[MasterPmTopic] SET Active = 0 WHERE PmTopicID = ${PmTopicID};`;
        await pool.request().query(deletePmTopic);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Repair ==========
// Repair Type
router.post('/repair/type', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let repairType = await pool.request().query(`SELECT a.RepairTypeID, a.RepairType
        FROM [Jig].[MasterRepairType] a
        WHERE a.Active = 1;
        `);
        res.json(repairType.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/type/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairType } = req.body;
        let insertRepairType = `INSERT INTO [Jig].[MasterRepairType](RepairType, Active) VALUES(N'${RepairType}', 1);`;
        await pool.request().query(insertRepairType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/repair/type/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairTypeID, RepairType } = req.body;
        let updateRepairType = `UPDATE [Jig].[MasterRepairType] SET RepairType = N'${RepairType}' WHERE RepairTypeID = ${RepairTypeID};`;
        await pool.request().query(updateRepairType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/repair/type/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairTypeID } = req.body;
        let deleteRepairType = `UPDATE [Jig].[MasterRepairType] SET Active = 0 WHERE RepairTypeID = ${RepairTypeID};`;
        await pool.request().query(deleteRepairType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Repair Problem
router.post('/repair/problem', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairTypeID } = req.body;
        let repairProblem = await pool.request().query(`SELECT a.RepairProblemID, a.RepairTypeID, a.RepairProblem
        FROM [Jig].[MasterRepairProblem] a
        WHERE a.Active = 1 AND RepairTypeID = ${RepairTypeID || null};
        `);
        res.json(repairProblem.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/problem/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairTypeID, RepairProblem } = req.body;
        let insertRepairProblem = `INSERT INTO [Jig].[MasterRepairProblem](RepairTypeID, RepairProblem, Active) VALUES(${RepairTypeID}, N'${RepairProblem}', 1);`;
        await pool.request().query(insertRepairProblem);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/repair/problem/edit', async (req, res) => { //* Change to insert new Record
    try {
        let pool = await sql.connect(config);
        let { RepairProblemID, RepairProblem } = req.body;
        let problemEdit = `DECLARE @RepairTypeID INT;
        SELECT @RepairTypeID = RepairTypeID FROM [Jig].[MasterRepairProblem] WHERE RepairProblemID = ${RepairProblemID};

        INSERT INTO [Jig].[MasterRepairProblem](RepairTypeID, RepairProblem, Active)
        VALUES(@RepairTypeID, N'${RepairProblem}', 1);

        UPDATE [Jig].[MasterRepairProblem] SET Active = 0 WHERE RepairProblemID = ${RepairProblemID};
        `;
        await pool.request().query(problemEdit);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/repair/problem/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { RepairProblemID } = req.body;
        let deleteRepairProblem = `UPDATE [Jig].[MasterRepairProblem] SET Active = 0 WHERE RepairProblemID = ${RepairProblemID};`;
        await pool.request().query(deleteRepairProblem);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Spare Part ==========
// Spare Part
router.post('/sparepart', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareCategoryID } = req.body;
        if (SpareCategoryID) {
            var sparepart = await pool.request().query(`SELECT a.SpareID, a.SpareName, a.AxCode, a.SpareLocationID, a.SpareCategoryID, a.Min, a.Max, a.Price, b.Category, c.Location
            FROM [Jig].[MasterSpare] a
            LEFT JOIN [Jig].[MasterSpareCategory] b ON b.SpareCategoryID = a.SpareCategoryID
            LEFT JOIN [Jig].[MasterSpareLocation] c ON c.SpareLocationID = a.SpareLocationID
            WHERE a.SpareCategoryID = ${SpareCategoryID} AND a.Active = 1;
            `);
        } else {
            var sparepart = await pool.request().query(`SELECT a.SpareID, a.SpareName, a.AxCode, a.SpareLocationID, a.SpareCategoryID, a.Min, a.Max, a.Price, b.Category, c.Location
            FROM [Jig].[MasterSpare] a
            LEFT JOIN [Jig].[MasterSpareCategory] b ON b.SpareCategoryID = a.SpareCategoryID
            LEFT JOIN [Jig].[MasterSpareLocation] c ON c.SpareLocationID = a.SpareLocationID
            WHERE a.Active = 1;
            `);
        }
        res.json(sparepart.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareName, AxCode, SpareLocationID, SpareCategoryID, Min, Max, Price } = req.body;
        let insertSparepart = `INSERT INTO [Jig].[MasterSpare](SpareName, AxCode, SpareLocationID, SpareCategoryID, Min, Max, Price, Active)
        VALUES(N'${SpareName}', N'${AxCode}', ${SpareLocationID}, ${SpareCategoryID}, ${Min}, ${Max}, ${Price}, 1);
        `;
        await pool.request().query(insertSparepart);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareID, SpareName, AxCode, SpareLocationID, Min, Max, Price } = req.body;
        let updateSparepart = `UPDATE [Jig].[MasterSpare] SET SpareName = N'${SpareName}', AxCode = N'${AxCode}', SpareLocationID = ${SpareLocationID},
        Min = ${Min}, Max = ${Max}, Price = ${Price} WHERE SpareID = ${SpareID};`;
        await pool.request().query(updateSparepart);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareID } = req.body;
        let deleteSparepart = `UPDATE [Jig].[MasterSpare] SET Active = 0 WHERE SpareID = ${SpareID};`;
        await pool.request().query(deleteSparepart);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Sparepart Category
router.post('/sparepart/category', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let category = await pool.request().query(`SELECT SpareCategoryID, Category FROM [Jig].[MasterSpareCategory] WHERE Active = 1;`);
        res.json(category.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/category/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { Category } = req.body;
        let insertCategory = `INSERT INTO [Jig].[MasterSpareCategory](Category, Active) VALUES(N'${Category}', 1);`;
        await pool.request().query(insertCategory);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/category/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareCategoryID, Category } = req.body;
        let updateCategory = `UPDATE [Jig].[MasterSpareCategory] SET Category = N'${Category}' WHERE SpareCategoryID = ${SpareCategoryID};`;
        await pool.request().query(updateCategory);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/category/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareCategoryID } = req.body;
        let deleteCategory = `UPDATE [Jig].[MasterSpareCategory] SET Active = 0 WHERE SpareCategoryID = ${SpareCategoryID};`;
        await pool.request().query(deleteCategory);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Sparepart Location
router.post('/sparepart/location', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let location = await pool.request().query(`SELECT a.SpareLocationID, a.Location FROM [Jig].[MasterSpareLocation] a WHERE a.Active = 1;`);
        res.json(location.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/location/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { Location } = req.body;
        let insertLocation = `INSERT INTO [Jig].[MasterSpareLocation](Location, Active) VALUES(N'${Location}', 1);`;
        await pool.request().query(insertLocation);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/location/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareLocationID, Location } = req.body;
        let updateLocation = `UPDATE [Jig].[MasterSpareLocation] SET Location = N'${Location}' WHERE SpareLocationID = ${SpareLocationID};`;
        await pool.request().query(updateLocation);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/location/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SpareLocationID } = req.body;
        let deleteLocation = `UPDATE [Jig].[MasterSpareLocation] SET Active = 0 WHERE SpareLocationID = ${SpareLocationID};`;
        await pool.request().query(deleteLocation);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Sparepart Supplier
router.post('/sparepart/supplier', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let suppliers = await pool.request().query(`SELECT a.SupplierID, a.SupplierName FROM [Jig].[MasterSupplier] a WHERE a.Active = 1;`);
        res.json(suppliers.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/supplier/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SupplierName } = req.body;
        let insertSupplier = `INSERT INTO [Jig].[MasterSupplier](SupplierName, Active) VALUES(N'${SupplierName}', 1);`;
        await pool.request().query(insertSupplier);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/supplier/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SupplierID, SupplierName } = req.body;
        let updateSupplier = `UPDATE [Jig].[MasterSupplier] SET SupplierName = N'${SupplierName}' WHERE SupplierID = ${SupplierID};`;
        await pool.request().query(updateSupplier);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/supplier/delete', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SupplierID } = req.body;
        let deleteSupplier = `UPDATE [Jig].[MasterSupplier] SET Active = 0 WHERE SupplierID = ${SupplierID};`;
        await pool.request().query(deleteSupplier);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Skill ==========
const storageTechnicianImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/technician'),
    filename: (req, file, cb) => {
        let { EmployeeID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${EmployeeID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadTechnicianImage = multer({ storage: storageTechnicianImage }).single('technician_image');

const storageTechnicianSkill = multer.diskStorage({
    destination: path.join(__dirname, '../../public/jig/tech_skill'),
    filename: (req, file, cb) => {
        let { EmployeeID, SkillID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth()+1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${EmployeeID}_SkillID_${uploadDateStr}` + '.' + ext);
    }
});
const uploadTechnicianSkill = multer({ storage: storageTechnicianSkill }).single('technician_skill');

// Skill
router.post('/skill', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let skill = await pool.request().query(`SELECT a.SkillID, a.Skill
        FROM [Jig].[MasterSkill] a
        WHERE a.Active = 1;
        `);
        res.json(skill.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/skill/add', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { Skill } = req.body;
        let insertSkill = `INSERT INTO [Jig].[MasterSkill](Skill, Active) VALUES(N'${Skill}', 1);`;
        await pool.request().query(insertSkill);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/skill/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { SkillID, Skill } = req.body;
        let updateSkill = `UPDATE [Jig].[MasterSkill] SET Skill = N'${Skill}' WHERE SkillID = ${SkillID};`;
        await pool.request().query(updateSkill);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/skill/delete', async (req, res) => { //TODO: change %
    try {
        let pool = await sql.connect(config);
        let { SkillID } = req.body;
        let deleteSkill = `UPDATE [Jig].[MasterSkill] SET Active = 0 WHERE SkillID = ${SkillID};`;
        await pool.request().query(deleteSkill);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Position Skill
// Get Position from User Where Department Jig
router.post('/skill/position', async (req, res) => { // Where DepartmentID ของ EM ID = 16
    try {
        let pool = await sql.connect(config);

        //todo edit DepartmentID to 16
        let position = await pool.request().query(`SELECT DISTINCT b.PositionID, b.PositionName
        FROM [TSMolymer_F].[dbo].[User] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterPosition] b ON a.PositionID = b.PositionID
        WHERE a.DepartmentID = 5;
        `);
        res.json(position.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/skill/position/skill', async (req, res) => { //* initial Skill by Position
    try {
        let pool = await sql.connect(config);
        let { PositionID } = req.body;
        let positionSkill = await pool.request().query(`SELECT a.PositionSkillID, a.PositionID, a.UsedSkill
        FROM [Jig].[MasterPositionSkill] a
        WHERE a.PositionID = ${PositionID};
        `);

        if(positionSkill.recordset.length){
            let UsedSkillJson = JSON.parse(positionSkill.recordset[0].UsedSkill);
            let Skill = [];
            for(let item of UsedSkillJson){
                let getSkill = await pool.request().query(`SELECT a.SkillID, a.Skill FROM [Jig].[MasterSkill] a WHERE a.SkillID = ${item.SkillID} AND a.Active = 1;`);
                if(getSkill.recordset.length){
                    Skill.push(getSkill.recordset[0]);
                }
            }
            positionSkill.recordset[0].Skill = Skill;
        }

        res.json(positionSkill.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/skill/position/edit', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { PositionID, UsedSkill } = req.body;

        let updatePositionSkill = `DECLARE @PositionSkillID INT;
        SELECT @PositionSkillID = PositionSkillID FROM [Jig].[MasterPositionSkill] WHERE PositionID = ${PositionID};

        IF(@PositionSkillID IS NOT NULL)
        BEGIN
            UPDATE [Jig].[MasterPositionSkill] SET UsedSkill = N'${UsedSkill}' WHERE PositionSkillID = @PositionSkillID;
        END
        ELSE
        BEGIN
            INSERT INTO [Jig].[MasterPositionSkill](PositionID, UsedSkill, Active) VALUES(${PositionID}, N'${UsedSkill}', 1);
        END;
        `;
        await pool.request().query(updatePositionSkill);

        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Technician Skill
router.post('/skill/technician', async (req, res) => { // Where DepartmentID = 16
    try {
        let pool = await sql.connect(config);
        let skill = await pool.request().query(`SELECT a.UserID, a.FirstName, c.PositionID, c.PositionName, c.PositionLevel, b.DepartmentID, b.DepartmentName,
        d.ImagePath, d.SkillScore, a.EmployeeID
        FROM [TSMolymer_F].[dbo].[User] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterDepartment] b ON a.DepartmentID = b.DepartmentID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterPosition] c ON a.PositionID = c.PositionID
        LEFT JOIN [TSM_Jig].[Jig].[MasterTechnician] d ON a.UserID = d.UserID
        WHERE c.PositionName like '%tech%'
        `);
        for(let user of skill.recordset){
            user.FirstName = atob(user.FirstName);
        }
        res.json(skill.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/skill/technician/skill', async (req, res) => { //* get Tech Skill
    try {
        let pool = await sql.connect(config);
        let { PositionID, UserID } = req.body;
        let PositionSkill = await pool.request().query(`SELECT a.PositionSkillID, a.PositionID, a.UsedSkill, a.TotalUsedSkill
        FROM [TSM_Jig].[Jig].[MasterPositionSkill] a
        WHERE a.PositionID = ${PositionID};
        `);
        if(PositionSkill.recordset.length){
            let UsedSkillJson = JSON.parse(PositionSkill.recordset[0].UsedSkill);
            let Skill = [];
            for(let item of UsedSkillJson){
                let getSkill = await pool.request().query(`SELECT a.SkillID, a.Skill FROM [Jig].[MasterSkill] a WHERE a.SkillID = ${item.SkillID} AND a.Active = 1;`);
                if(getSkill.recordset.length){
                    Skill.push(getSkill.recordset[0]);
                }
            }
            PositionSkill.recordset[0].Skill = Skill;
        }

        let TechSkill = await pool.request().query(`WITH cte AS (
            SELECT ROW_NUMBER() OVER (PARTITION BY a.SkillID ORDER BY a.TechSkillID DESC) AS RowNum,
            a.SkillID, a.Score
            FROM [TSM_Jig].[Jig].[MasterTechSkill] a
            WHERE a.UserID = ${UserID}
        )
        SELECT a.SkillID, a.Score
        FROM [cte] a
        WHERE a.RowNum = 1;
        `);
        res.json({ PositionSkill: PositionSkill.recordset, TechSkill: TechSkill.recordset });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/skill/technician/skill/item/history', async (req, res) => { //* get Tech Skill History (date, file)
    try {
        let pool = await sql.connect(config);
        let { UserID, SkillID } = req.body;

        let TechSkill = await pool.request().query(`SELECT a.TechSkillID, a.UpdatedAt, a.FilePath, a.Score
        FROM [TSM_Jig].[Jig].[MasterTechSkill] a
        WHERE a.UserID = ${UserID} AND a.SkillID = ${SkillID}
        ORDER BY a.UpdatedAt;
        `);
        res.json(TechSkill.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/skill/technician/skill/item', async (req, res) => { //* get Tech Skill which selected
    try {
        let pool = await sql.connect(config);
        let { TechSkillID } = req.body;
        let TechSkill = await pool.request().query(`SELECT a.TechSkillID, b.SkillID, b.Skill, a.UpdatedAt, a.Score, a.FilePath
        FROM [TSM_Jig].[Jig].[MasterTechSkill] a
        LEFT JOIN [TSM_Jig].[Jig].[MasterSkill] b ON a.SkillID = b.SkillID
        WHERE a.TechSkillID = ${TechSkillID};
        `);
        res.json(TechSkill.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/skill/technician/image/upload', async (req, res) => {
    uploadTechnicianImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                console.log(req.files);
                let pool = await sql.connect(config);
                let { UserID } = req.body;
                let ImagePath = (req.file) ? "/jig/technician/" + req.file.filename : ""
                let insertFilePath = `
                DECLARE @UserID INT;
                SELECT @UserID = UserID FROM [Jig].[MasterTechnician] WHERE UserID = ${UserID};

                IF(@UserID IS NULL)
                BEGIN
                    INSERT INTO [Jig].[MasterTechnician](UserID, ImagePath) VALUES(${UserID}, '${ImagePath}');
                END
                ELSE
                BEGIN
                    UPDATE [Jig].[MasterTechnician] SET ImagePath = '${ImagePath}' WHERE UserID = ${UserID};
                END;
                `;
                await pool.request().query(insertFilePath);
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
router.post('/skill/technician/skill/train', async (req, res) => { //TODO: EditUser
    uploadTechnicianSkill(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await sql.connect(config);
                let { UserID, SkillID, Score } = req.body;
                let reqUserID = req.session.UserID;
                let FilePath = "/jig/tech_skill/" + req.file.filename;
                let insertFilePath = `
                INSERT INTO [Jig].[MasterTechSkill](UserID, SkillID, Score, FilePath, UpdatedAt, UpdatedUser) VALUES(${UserID}, ${SkillID}, ${Score}, '${FilePath}', GETDATE(), ${reqUserID || 0});

                DECLARE @CntTech INT;
                SELECT @CntTech = COUNT(UserID) FROM [Jig].[MasterTechnician] WHERE UserID = ${UserID};
                IF(@CntTech IS NULL)
                BEGIN
                    INSERT INTO [Jig].[MasterTechnician](UserID) VALUES(${UserID});
                END;
                `;
                await pool.request().query(insertFilePath);

                let totalScore = await pool.request().query(`SELECT COUNT(a.TechSkillID) AS CntSkill, SUM(a.Score) AS Score FROM [TechSkill] a WHERE a.UserID = ${UserID};`);
                let SkillScore = !totalScore.recordset[0].CntSkill ? 0 : (totalScore.recordset[0].Score / totalScore.recordset[0].CntSkill);
                let updateScore = `DECLARE @UserID INT;
                SELECT @UserID = UserID FROM [Jig].[MasterTechnician] WHERE UserID = ${UserID};

                IF(@UserID IS NULL)
                BEGIN
                    INSERT INTO [Jig].[MasterTechnician](UserID, SkillScore) VALUES(${UserID}, ${SkillScore});
                END
                ELSE
                BEGIN
                    UPDATE [Jig].[MasterTechnician] SET SkillScore = ${SkillScore} WHERE UserID = @UserID;
                END;
                `;
                await pool.request().query(updateScore);

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

//* ========== Document Control ==========
router.post('/docctrl', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let DocCtrl = await pool.request().query(`SELECT DocumentID, DocumentCtrlNo, DocumentName
        FROM [Jig].[MasterDocumentCtrl];
        `);
        res.json(DocCtrl.recordset)
    } catch(err){
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/docctrl/item', async (req, res) => {
    try {
        let pool = await sql.connect(config);
        let { DocumentName } = req.body;
        let DocCtrl = await pool.request().query(`SELECT DocumentID, DocumentCtrlNo, DocumentName
        FROM [Jig].[MasterDocumentCtrl]
        WHERE DocumentName = '${DocumentName}';
        `);
        res.json(DocCtrl.recordset)
    } catch(err){
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/docctrl/edit', async (req, res) => {
    try
    {
        let pool = await sql.connect(config);
        let { DocumentID, DocumentName, DocumentCtrlNo } = req.body;
        let updateDocCrtl = `
        DECLARE @DocumentID INT
        SET @DocumentID = (SELECT DocumentID FROM [Jig].[MasterDocumentCtrl] WHERE DocumentName = '${DocumentName}');

        IF(@DocumentID IS NULL)
	        BEGIN
		        INSERT INTO [Jig].[MasterDocumentCtrl] (DocumentCtrlNo, DocumentName) VALUES('${DocumentCtrlNo}', '${DocumentName}');
	        END
        ELSE
	        BEGIN
		        UPDATE [Jig].[MasterDocumentCtrl] SET DocumentCtrlNo = '${DocumentCtrlNo}', DocumentName = '${DocumentName}' WHERE DocumentID = @DocumentID;
	        END
        `;
        await pool.request().query(updateDocCrtl);
        res.json({ message:`Success` });
    }
    catch(err){
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})



module.exports = router;

//? Jig
/**
 * @swagger
 * /jig/setting/jig:
 *   post:
 *     summary: Returns all Jig List filter by Customer
 *     responses:
 *       200:
 *         description: A JSON array of Jig list
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /jig/setting/jig/edit:
 *   put:
 *     summary: Returns all Jig List filter by Customer
 *     responses:
 *       200:
 *         description: A JSON array of Jig list
 *       500:
 *         description: Internal Server Error
 */

//? Jig Type
/**
 * @swagger
 * /jig/setting/jig/type:
 *   post:
 *     summary: Returns all Jig List filter by Customer
 *     responses:
 *       200:
 *         description: A JSON array of Jig list
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /jig/setting/jig/type/add:
 *   post:
 *     summary: Returns all Jig List filter by Customer
 *     responses:
 *       200:
 *         description: A JSON array of Jig list
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /jig/setting/jig/type/edit:
 *   put:
 *     summary: Returns all Jig List filter by Customer
 *     responses:
 *       200:
 *         description: A JSON array of Jig list
 *       500:
 *         description: Internal Server Error
 */

/**
 * @swagger
 * /jig/setting/jig/type/delete:
 *   delete:
 *     summary: Returns all Jig List filter by Customer
 *     responses:
 *       200:
 *         description: A JSON array of Jig list
 *       500:
 *         description: Internal Server Error
 */

