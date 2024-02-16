const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const multer = require('multer');
const path = require('path');
const { getPool } = require('../../middlewares/pool-manager');

//* ========== Mold Setting ==========
router.post('/mold', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let mold = await pool.request().query(`SELECT a.MoldID, a.MoldControlNo, a.BasicMold, a.DieNo, a.MoldName, a.CustomerID, b.CustomerName,
        a.CustomerAssetNo, a.Cavity, a.RawMaterial, a.ReceivedDate, a.LastProduction, a.Status, a.MoldSpecID
        FROM [Mold].[MasterMold] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        ORDER BY a.ReceivedDate
        `);
        res.json(mold.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/mold/specification', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID } = req.body;
        let moldSpec = await pool.request().query(`SELECT a.MoldSpeciD, a.CustomerID, b.CustomerName, a.PartCode, a.PartName, a.AxMoldNo,
        a.Model, a.IssuedDate, a.Status, a.MachineSpec, a.ProductSpec, a.MoldSpec,
        c.FirstName AS IssueBy, a.IssueSignTime,
        d.FirstName AS CheckBy, a.CheckSignTime,
        e.FirstName AS ApproveBy, a.ApproveSignTime
        FROM [Mold].[MoldSpecification] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterCustomer] b ON b.CustomerID = a.CustomerID
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.IssuBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = a.CheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON e.EmployeeID = a.ApproveBy
        WHERE a.MoldSpeciD = ${MoldSpecID};
        `);
        if (moldSpec.recordset.length) {
            moldSpec.recordset[0].IssueBy = !moldSpec.recordset[0].IssueBy ? null : atob(moldSpec.recordset[0].IssueBy);
            moldSpec.recordset[0].CheckBy = !moldSpec.recordset[0].CheckBy ? null : atob(moldSpec.recordset[0].CheckBy);
            moldSpec.recordset[0].ApproveBy = !moldSpec.recordset[0].ApproveBy ? null : atob(moldSpec.recordset[0].ApproveBy);
        }
        res.json(moldSpec.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/mold/receive', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldSpecID } = req.body;
        let moldReceive = await pool.request().query(`SELECT a.MoldReceiveID, a.BasicMold, a.DieNo, a.MoldCounterNo, a.PartName, a.MaterialGrade,
        a.GuaranteeShot, a.MoldWeight, a.Cavity, a.MoldSize, a.MoldType, a.Model, a.CustomerMoldWarranty,
        a.AppearanceInspect, a.MoldStructure, a.ImagePath,
        b.FirstName AS MoldIssueBy, a.MoldIssueTime,
        c.FirstName AS MoldCheckBy, a.MoldCheckTime,
        d.FirstName AS MoldApproveBy, a.MoldApproveTime,
        e.FirstName AS EnCheckBy, a.EnCheckTime,
        f.FirstName AS EnApproveBy, a.EnApproveBy
        FROM [Mold].[MoldReceive] a
        LEFT JOIN [TSMolymer_F].[dbo].[User] b ON b.EmployeeID = a.MoldIssueBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] c ON c.EmployeeID = a.MoldCheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] d ON d.EmployeeID = a.MoldApproveBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] e ON e.EmployeeID = a.EnCheckBy
        LEFT JOIN [TSMolymer_F].[dbo].[User] f ON f.EmployeeID = a.EnApproveBy
        WHERE a.MoldSpecID = ${MoldSpecID};
        `);
        res.json(moldReceive.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Receive ==========
router.post('/receive', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let receiveCheck = await pool.request().query(`SELECT ReceiveCheckID, InspectionDetail, Description FROM [Mold].[MasterReceiveCheck] WHERE Active = 1;`);
        res.json(receiveCheck.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/receive/add', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { InspectionDetail, Description } = req.body;
        let insertReceiveCheck = `INSERT INTO [Mold].[MasterReceiveCheck](InspectionDetail, Description, Active)
        VALUES(N'${InspectionDetail}', N'${Description}', 1);
        `;
        await pool.request().query(insertReceiveCheck);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/receive/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveCheckID, InspectionDetail, Description } = req.body;
        let updateReceiveCheck = `UPDATE [Mold].[MasterReceiveCheck] SET InspectionDetail = N'${InspectionDetail}', Description = N'${Description}'
        WHERE ReceiveCheckID = ${ReceiveCheckID};
        `;
        await pool.request().query(updateReceiveCheck);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/receive/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ReceiveCheckID } = req.body;
        let deleteReceiveCheck = `UPDATE [Mold].[MasterReceiveCheck] SET Active = 0 WHERE ReceiveCheckID = ${ReceiveCheckID};`;
        await pool.request().query(deleteReceiveCheck);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Maintenace ==========
// Maintenance
const storagePmImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/pm_checkfile'),
    filename: (req, file, cb) => {
        let { MoldID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${MoldID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadPmImage = multer({ storage: storagePmImage }).single('pm_checkfile');

router.post('/maintenace', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID } = req.body;
        console.log('object :>> ', `SELECT a.PmID, a.MoldID, a.WarningShot, a.DangerShot, a.WarrantyShot,
        a.AlertPercent, a.AlertWarrantyPercent, a.ImagePath, a.PmTopic
        FROM [Mold].[MasterPm] a
        WHERE a.MoldID = ${MoldID};
        `);
        let maintenance = await pool.request().query(`SELECT a.PmID, a.MoldID, a.WarningShot, a.DangerShot, a.WarrantyShot,
        a.AlertPercent, a.AlertWarrantyPercent, a.ImagePath, a.PmTopic
        FROM [Mold].[MasterPm] a
        WHERE a.MoldID = ${MoldID};
        `);
        res.json(maintenance.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/pm/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID, WarningShot, DangerShot, WarrantyShot, AlertPercent, AlertWarrantyPercent } = req.body;
        console.log('object :>> ', `DECLARE @PmID INT;
        SET @PmID = (SELECT PmID FROM [Mold].[MasterPm] WHERE MoldID = ${MoldID});

        IF(@PmID IS NULL) -- Insert
        BEGIN
            INSERT INTO [Mold].[MasterPm](MoldID, WarningShot, DangerShot, WarrantyShot, AlertPercent, AlertWarrantyPercent)
            VALUES(${MoldID}, ${WarningShot}, ${DangerShot}, ${WarrantyShot}, ${AlertPercent}, ${AlertWarrantyPercent});
        END
        ELSE -- Update
        BEGIN
            UPDATE [Mold].[MasterPm] SET WarningShot = ${WarningShot}, DangerShot = ${DangerShot}, WarrantyShot = ${WarrantyShot},
            AlertPercent = ${AlertPercent}, AlertWarrantyPercent = ${AlertWarrantyPercent}
            WHERE PmID = @PmID;
        END;
        `);
        let updatePm = `DECLARE @PmID INT;
        SET @PmID = (SELECT PmID FROM [Mold].[MasterPm] WHERE MoldID = ${MoldID});

        IF(@PmID IS NULL) -- Insert
        BEGIN
            INSERT INTO [Mold].[MasterPm](MoldID, WarningShot, DangerShot, WarrantyShot, AlertPercent, AlertWarrantyPercent)
            VALUES(${MoldID}, ${WarningShot}, ${DangerShot}, ${WarrantyShot}, ${AlertPercent}, ${AlertWarrantyPercent});
        END
        ELSE -- Update
        BEGIN
            UPDATE [Mold].[MasterPm] SET WarningShot = ${WarningShot}, DangerShot = ${DangerShot}, WarrantyShot = ${WarrantyShot},
            AlertPercent = ${AlertPercent}, AlertWarrantyPercent = ${AlertWarrantyPercent}
            WHERE PmID = @PmID;
        END;
        `;
        await pool.request().query(updatePm);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/pm/checkfile/upload', async (req, res) => {
    uploadPmImage(req, res, async (err) => {
        if (err) {
            console.log(req.url, 'Upload ERROR', err);
            res.status(500).send({ message: `${err}` });
        } else {
            try {
                let pool = await getPool('MoldPool', config);
                let ImagePath = (req.file) ? "/mold/pm_checkfile/" + req.file.filename : "";
                let { MoldID } = req.body;
                let updatePmCheckfile = `DECLARE @PmID INT;
                SET @PmID = (SELECT PmID FROM [Mold].[MasterPm] WHERE MoldID = ${MoldID});

                IF(@PmID IS NULL) -- Insert
                BEGIN
                    INSERT INTO [Mold].[MasterPm](MoldID, ImagePath)
                    VALUES(${MoldID}, '${ImagePath}');
                END
                ELSE -- Update
                BEGIN
                    UPDATE [Mold].[MasterPm] SET ImagePath = '${ImagePath}' WHERE PmID = @PmID;
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
router.put('/maintenace/inspect/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { MoldID, InspectionID } = req.body;
        let getMoldInspect = await pool.request().query(`SELECT PmID, MoldID, PmTopic FROM [Mold].[MasterPm] WHERE MoldID = ${MoldID};`);

        if (getMoldInspect.recordset.length) {
            let PmID = getMoldInspect.recordset[0].PmID;
            let PmTopic = JSON.parse(getMoldInspect.recordset[0].PmTopic);
            if(PmTopic.find(v=>v==InspectionID)){
                PmTopic = PmTopic.filter(v=>v!=InspectionID);
            } else{
                PmTopic.push(InspectionID);
            }
            let updateMoldInspect = `UPDATE [Mold].[MasterPm] SET PmTopic = N'[${PmTopic}]' WHERE PmID = ${PmID};`;
            await pool.request().query(updateMoldInspect);
        } else {
            let insertMoldInspect = `INSERT INTO [Mold].[MasterPm](MoldID, PmTopic) VALUES(${MoldID}, N'[${InspectionID}]');`;
            await pool.request().query(insertMoldInspect);
        }
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

// Inspection
router.post('/maintenace/inspection', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let inspection = await pool.request().query(`SELECT InspectionID, Detail, Description FROM [Mold].[MasterInspectionDetail] WHERE Active = 1;`);
        res.json(inspection.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/inspection/add', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { Detail, Description } = req.body;
        let insertInspection = `INSERT INTO [Mold].[MasterInspectionDetail](Detail, Description, Active)
        VALUES(N'${Detail}', N'${Description}', 1);
        `;
        await pool.request().query(insertInspection);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/maintenace/inspection/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { InspectionID, Detail, Description } = req.body;
        let updateInspect = `UPDATE [Mold].[MasterInspectionDetail] SET Detail = N'${Detail}', Description = N'${Description}' WHERE InspectionID = ${InspectionID};`;
        await pool.request().query(updateInspect);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/maintenace/inspection/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { InspectionID } = req.body;
        let deleteInspect = `UPDATE [Mold].[MasterInspectionDetail] SET Active = 0 WHERE InspectionID = ${InspectionID};`;
        await pool.request().query(deleteInspect);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Process
router.post('/maintenace/process', async (req, res) => { // ProcessType = 1
    try {
        let pool = await getPool('MoldPool', config);
        let process = await pool.request().query(`SELECT ProcessID, Detail, CostPerHour FROM [Mold].[MasterProcess]
        WHERE Active = 1 AND ProcessType = 1;
        `);
        res.json(process.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/maintenace/process/add', async (req, res) => { //ProcessType = 1
    try {
        let pool = await getPool('MoldPool', config);
        let { Detail, CostPerHour } = req.body;
        let insertProcess = `INSERT INTO [Mold].[MasterProcess](Detail, CostPerHour, ProcessType, Active)
        VALUES(N'${Detail}', ${CostPerHour}, 1, 1);
        `;
        await pool.request().query(insertProcess);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/maintenace/process/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ProcessID, Detail, CostPerHour } = req.body;
        let updateProcess = `UPDATE [Mold].[MasterProcess] SET Detail = N'${Detail}', CostPerHour = ${CostPerHour} WHERE ProcessID = ${ProcessID};`;
        await pool.request().query(updateProcess);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/maintenace/process/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ProcessID } = req.body;
        let deleteProcess = `UPDATE [Mold].[MasterProcess] SET Active = 0 WHERE ProcessID = ${ProcessID};`;
        await pool.request().query(deleteProcess);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Repair ==========
// Repair Type
router.post('/repair/type', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let repairType = await pool.request().query(`SELECT a.RepairTypeID, a.RepairType
        FROM [Mold].[MasterRepairType] a
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
        let pool = await getPool('MoldPool', config);
        let { RepairType } = req.body;
        let insertRepairType = `INSERT INTO [Mold].[MasterRepairType](RepairType, Active) VALUES(N'${RepairType}', 1);`;
        await pool.request().query(insertRepairType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/repair/type/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { RepairTypeID, RepairType } = req.body;
        let updateRepairType = `UPDATE [Mold].[MasterRepairType] SET RepairType = N'${RepairType}' WHERE RepairTypeID = ${RepairTypeID};`;
        await pool.request().query(updateRepairType);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/repair/type/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { RepairTypeID } = req.body;
        let deleteRepairType = `UPDATE [Mold].[MasterRepairType] SET Active = 0 WHERE RepairTypeID = ${RepairTypeID};`;
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
        let pool = await getPool('MoldPool', config);
        let { RepairTypeID } = req.body;
        let repairProblem = await pool.request().query(`SELECT a.RepairProblemID, a.RepairTypeID, a.RepairProblem
        FROM [Mold].[MasterRepairProblem] a
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
        let pool = await getPool('MoldPool', config);
        let { RepairTypeID, RepairProblem } = req.body;
        let insertRepairProblem = `INSERT INTO [Mold].[MasterRepairProblem](RepairTypeID, RepairProblem, Active) VALUES(${RepairTypeID}, N'${RepairProblem}', 1);`;
        await pool.request().query(insertRepairProblem);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/repair/problem/edit', async (req, res) => { //* Change to insert new Record
    try {
        let pool = await getPool('MoldPool', config);
        let { RepairProblemID, RepairProblem } = req.body;
        let problemEdit = `DECLARE @RepairTypeID INT;
        SELECT @RepairTypeID = RepairTypeID FROM [Mold].[MasterRepairProblem] WHERE RepairProblemID = ${RepairProblemID};

        INSERT INTO [Mold].[MasterRepairProblem](RepairTypeID, RepairProblem, Active)
        VALUES(@RepairTypeID, N'${RepairProblem}', 1);

        UPDATE [Mold].[MasterRepairProblem] SET Active = 0 WHERE RepairProblemID = ${RepairProblemID};
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
        let pool = await getPool('MoldPool', config);
        let { RepairProblemID } = req.body;
        let deleteRepairProblem = `UPDATE [Mold].[MasterRepairProblem] SET Active = 0 WHERE RepairProblemID = ${RepairProblemID};`;
        await pool.request().query(deleteRepairProblem);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Repair Process
router.post('/repair/process', async (req, res) => { // ProcessType = 2
    try {
        let pool = await getPool('MoldPool', config);
        let process = await pool.request().query(`SELECT ProcessID, Detail, CostPerHour FROM [Mold].[MasterProcess]
        WHERE Active = 1 AND ProcessType = 2;
        `);
        res.json(process.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/repair/process/add', async (req, res) => { // ProcessType = 2
    try {
        let pool = await getPool('MoldPool', config);
        let { Detail, CostPerHour } = req.body;
        let insertProcess = `INSERT INTO [Mold].[MasterProcess](Detail, CostPerHour, ProcessType, Active)
        VALUES(N'${Detail}', ${CostPerHour}, 2, 1);
        `;
        await pool.request().query(insertProcess);

        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/repair/process/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ProcessID, Detail, CostPerHour } = req.body;
        let updateProcess = `UPDATE [Mold].[MasterProcess] SET Detail = N'${Detail}', CostPerHour = ${CostPerHour} WHERE ProcessID = ${ProcessID};`;
        await pool.request().query(updateProcess);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/repair/process/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { ProcessID } = req.body;
        let deleteProcess = `UPDATE [Mold].[MasterProcess] SET Active = 0 WHERE ProcessID = ${ProcessID};`;
        await pool.request().query(deleteProcess);
        res.json({ message: 'Success' });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})


//* ========== Spare Part ==========
// Spare Part
router.post('/sparepart', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SpareCategoryID } = req.body;
        if (SpareCategoryID) {
            var sparepart = await pool.request().query(`SELECT a.SpareID, a.SpareName, a.AxCode, a.SpareLocationID, a.SpareCategoryID, a.Min, a.Max, a.Price, b.Category, c.Location
            FROM [Mold].[MasterSpare] a
            LEFT JOIN [Mold].[MasterSpareCategory] b ON b.SpareCategoryID = a.SpareCategoryID
            LEFT JOIN [Mold].[MasterSpareLocation] c ON c.SpareLocationID = a.SpareLocationID
            WHERE a.SpareCategoryID = ${SpareCategoryID} AND a.Active = 1;
            `);
        } else {
            var sparepart = await pool.request().query(`SELECT a.SpareID, a.SpareName, a.AxCode, a.SpareLocationID, a.SpareCategoryID, a.Min, a.Max, a.Price, b.Category, c.Location
            FROM [Mold].[MasterSpare] a
            LEFT JOIN [Mold].[MasterSpareCategory] b ON b.SpareCategoryID = a.SpareCategoryID
            LEFT JOIN [Mold].[MasterSpareLocation] c ON c.SpareLocationID = a.SpareLocationID
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
        let pool = await getPool('MoldPool', config);
        let { SpareName, AxCode, SpareLocationID, SpareCategoryID, Min, Max, Price } = req.body;
        let insertSparepart = `INSERT INTO [Mold].[MasterSpare](SpareName, AxCode, SpareLocationID, SpareCategoryID, Min, Max, Price, Active)
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
        let pool = await getPool('MoldPool', config);
        let { SpareID, SpareName, AxCode, SpareLocationID, Min, Max, Price } = req.body;
        let updateSparepart = `UPDATE [Mold].[MasterSpare] SET SpareName = N'${SpareName}', AxCode = N'${AxCode}', SpareLocationID = ${SpareLocationID},
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
        let pool = await getPool('MoldPool', config);
        let { SpareID } = req.body;
        let deleteSparepart = `UPDATE [Mold].[MasterSpare] SET Active = 0 WHERE SpareID = ${SpareID};`;
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
        let pool = await getPool('MoldPool', config);
        let category = await pool.request().query(`SELECT SpareCategoryID, Category FROM [Mold].[MasterSpareCategory] WHERE Active = 1;`);
        res.json(category.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/category/add', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { Category } = req.body;
        let insertCategory = `INSERT INTO [Mold].[MasterSpareCategory](Category, Active) VALUES(N'${Category}', 1);`;
        await pool.request().query(insertCategory);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/category/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SpareCategoryID, Category } = req.body;
        let updateCategory = `UPDATE [Mold].[MasterSpareCategory] SET Category = N'${Category}' WHERE SpareCategoryID = ${SpareCategoryID};`;
        await pool.request().query(updateCategory);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/category/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SpareCategoryID } = req.body;
        let deleteCategory = `UPDATE [Mold].[MasterSpareCategory] SET Active = 0 WHERE SpareCategoryID = ${SpareCategoryID};`;
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
        let pool = await getPool('MoldPool', config);
        let location = await pool.request().query(`SELECT a.SpareLocationID, a.Location FROM [Mold].[MasterSpareLocation] a WHERE a.Active = 1;`);
        res.json(location.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/location/add', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { Location } = req.body;
        let insertLocation = `INSERT INTO [Mold].[MasterSpareLocation](Location, Active) VALUES(N'${Location}', 1);`;
        await pool.request().query(insertLocation);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/location/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SpareLocationID, Location } = req.body;
        let updateLocation = `UPDATE [Mold].[MasterSpareLocation] SET Location = N'${Location}' WHERE SpareLocationID = ${SpareLocationID};`;
        await pool.request().query(updateLocation);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/location/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SpareLocationID } = req.body;
        let deleteLocation = `UPDATE [Mold].[MasterSpareLocation] SET Active = 0 WHERE SpareLocationID = ${SpareLocationID};`;
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
        let pool = await getPool('MoldPool', config);
        let suppliers = await pool.request().query(`SELECT a.SupplierID, a.SupplierName FROM [Mold].[MasterSupplier] a WHERE a.Active = 1;`);
        res.json(suppliers.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.post('/sparepart/supplier/add', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SupplierName } = req.body;
        let insertSupplier = `INSERT INTO [Mold].[MasterSupplier](SupplierName, Active) VALUES(N'${SupplierName}', 1);`;
        await pool.request().query(insertSupplier);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/sparepart/supplier/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SupplierID, SupplierName } = req.body;
        let updateSupplier = `UPDATE [Mold].[MasterSupplier] SET SupplierName = N'${SupplierName}' WHERE SupplierID = ${SupplierID};`;
        await pool.request().query(updateSupplier);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/sparepart/supplier/delete', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SupplierID } = req.body;
        let deleteSupplier = `UPDATE [Mold].[MasterSupplier] SET Active = 0 WHERE SupplierID = ${SupplierID};`;
        await pool.request().query(deleteSupplier);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

//* ========== Skill ==========
const storageTechnicianImage = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/technician'),
    filename: (req, file, cb) => {
        let { EmployeeID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${EmployeeID}_${uploadDateStr}` + '.' + ext);
    }
});
const uploadTechnicianImage = multer({ storage: storageTechnicianImage }).single('technician_image');

const storageTechnicianSkill = multer.diskStorage({
    destination: path.join(__dirname, '../../public/mold/tech_skill'),
    filename: (req, file, cb) => {
        let { EmployeeID, SkillID } = req.query;
        let uploadDate = new Date();
        let uploadDateStr = `${uploadDate.getFullYear()}-${uploadDate.getMonth() + 1}-${uploadDate.getDate()}_${uploadDate.getHours()}-${uploadDate.getMinutes()}-${uploadDate.getSeconds()}`;
        const ext = file.mimetype.split('/')[1];
        cb(null, `${EmployeeID}_SkillID_${uploadDateStr}` + '.' + ext);
    }
});
const uploadTechnicianSkill = multer({ storage: storageTechnicianSkill }).single('technician_skill');

// Skill
router.post('/skill', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let skill = await pool.request().query(`SELECT a.SkillID, a.Skill
        FROM [Mold].[MasterSkill] a
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
        let pool = await getPool('MoldPool', config);
        let { Skill } = req.body;
        let insertSkill = `INSERT INTO [Mold].[MasterSkill](Skill, Active) VALUES(N'${Skill}', 1);`;
        await pool.request().query(insertSkill);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/skill/edit', async (req, res) => {
    try {
        let pool = await getPool('MoldPool', config);
        let { SkillID, Skill } = req.body;
        let updateSkill = `UPDATE [Mold].[MasterSkill] SET Skill = N'${Skill}' WHERE SkillID = ${SkillID};`;
        await pool.request().query(updateSkill);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.delete('/skill/delete', async (req, res) => { //TODO: change %
    try {
        let pool = await getPool('MoldPool', config);
        let { SkillID } = req.body;
        let deleteSkill = `UPDATE [Mold].[MasterSkill] SET Active = 0 WHERE SkillID = ${SkillID};`;
        await pool.request().query(deleteSkill);
        res.json({ message: `Success` });
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
// Position Skill
// Get Position from User Where Department Mold
router.post('/skill/position', async (req, res) => { // Where DepartmentID ของ EM ID = 16
    try {
        let pool = await getPool('MoldPool', config);

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
        let pool = await getPool('MoldPool', config);
        let { PositionID } = req.body;
        let positionSkill = await pool.request().query(`SELECT a.PositionSkillID, a.PositionID, a.UsedSkill
        FROM [Mold].[MasterPositionSkill] a
        WHERE a.PositionID = ${PositionID};
        `);

        if (positionSkill.recordset.length) {
            let UsedSkillJson = JSON.parse(positionSkill.recordset[0].UsedSkill);
            let Skill = [];
            for (let item of UsedSkillJson) {
                let getSkill = await pool.request().query(`SELECT a.SkillID, a.Skill FROM [Mold].[MasterSkill] a WHERE a.SkillID = ${item.SkillID} AND a.Active = 1;`);
                if (getSkill.recordset.length) {
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
        let pool = await getPool('MoldPool', config);
        let { PositionID, UsedSkill } = req.body;

        let updatePositionSkill = `DECLARE @PositionSkillID INT;
        SELECT @PositionSkillID = PositionSkillID FROM [Mold].[MasterPositionSkill] WHERE PositionID = ${PositionID};

        IF(@PositionSkillID IS NOT NULL)
        BEGIN
            UPDATE [Mold].[MasterPositionSkill] SET UsedSkill = N'${UsedSkill}' WHERE PositionSkillID = @PositionSkillID;
        END
        ELSE
        BEGIN
            INSERT INTO [Mold].[MasterPositionSkill](PositionID, UsedSkill, Active) VALUES(${PositionID}, N'${UsedSkill}', 1);
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
        let pool = await getPool('MoldPool', config);
        let skill = await pool.request().query(`SELECT a.UserID, a.FirstName, c.PositionID, c.PositionName, c.PositionLevel, b.DepartmentID, b.DepartmentName,
        d.ImagePath, d.SkillScore, a.EmployeeID
        FROM [TSMolymer_F].[dbo].[User] a
        LEFT JOIN [TSMolymer_F].[dbo].[MasterDepartment] b ON a.DepartmentID = b.DepartmentID
        LEFT JOIN [TSMolymer_F].[dbo].[MasterPosition] c ON a.PositionID = c.PositionID
        LEFT JOIN [TSM_Mold].[Mold].[MasterTechnician] d ON a.UserID = d.UserID
        WHERE c.PositionName like '%tech%'
        `);
        for (let user of skill.recordset) {
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
        let pool = await getPool('MoldPool', config);
        let { PositionID, UserID } = req.body;
        let PositionSkill = await pool.request().query(`SELECT a.PositionSkillID, a.PositionID, a.UsedSkill, a.TotalUsedSkill
        FROM [TSM_Mold].[Mold].[MasterPositionSkill] a
        WHERE a.PositionID = ${PositionID};
        `);
        if (PositionSkill.recordset.length) {
            let UsedSkillJson = JSON.parse(PositionSkill.recordset[0].UsedSkill);
            let Skill = [];
            for (let item of UsedSkillJson) {
                let getSkill = await pool.request().query(`SELECT a.SkillID, a.Skill FROM [Mold].[MasterSkill] a WHERE a.SkillID = ${item.SkillID} AND a.Active = 1;`);
                if (getSkill.recordset.length) {
                    Skill.push(getSkill.recordset[0]);
                }
            }
            PositionSkill.recordset[0].Skill = Skill;
        }

        let TechSkill = await pool.request().query(`WITH cte AS (
            SELECT ROW_NUMBER() OVER (PARTITION BY a.SkillID ORDER BY a.TechSkillID DESC) AS RowNum,
            a.SkillID, a.Score
            FROM [TSM_Mold].[Mold].[MasterTechSkill] a
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
        let pool = await getPool('MoldPool', config);
        let { UserID, SkillID } = req.body;

        let TechSkill = await pool.request().query(`SELECT a.TechSkillID, a.UpdatedAt, a.FilePath, a.Score
        FROM [TSM_Mold].[Mold].[MasterTechSkill] a
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
        let pool = await getPool('MoldPool', config);
        let { TechSkillID } = req.body;
        let TechSkill = await pool.request().query(`SELECT a.TechSkillID, b.SkillID, b.Skill, a.UpdatedAt, a.Score, a.FilePath
        FROM [TSM_Mold].[Mold].[MasterTechSkill] a
        LEFT JOIN [TSM_Mold].[Mold].[MasterSkill] b ON a.SkillID = b.SkillID
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
                let pool = await getPool('MoldPool', config);
                let { UserID } = req.body;
                let ImagePath = (req.file) ? "/mold/technician/" + req.file.filename : ""
                let insertFilePath = `
                DECLARE @UserID INT;
                SELECT @UserID = UserID FROM [Mold].[MasterTechnician] WHERE UserID = ${UserID};

                IF(@UserID IS NULL)
                BEGIN
                    INSERT INTO [Mold].[MasterTechnician](UserID, ImagePath) VALUES(${UserID}, '${ImagePath}');
                END
                ELSE
                BEGIN
                    UPDATE [Mold].[MasterTechnician] SET ImagePath = '${ImagePath}' WHERE UserID = ${UserID};
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
                let pool = await getPool('MoldPool', config);
                let { UserID, SkillID, Score } = req.body;
                let reqUserID = req.session?.UserID || 0;
                let FilePath = "/mold/tech_skill/" + req.file.filename;
                let insertFilePath = `
                INSERT INTO [Mold].[MasterTechSkill](UserID, SkillID, Score, FilePath, UpdatedAt, UpdatedUser) VALUES(${UserID}, ${SkillID}, ${Score}, '${FilePath}', GETDATE(), ${reqUserID || 0});

                DECLARE @CntTech INT;
                SELECT @CntTech = COUNT(UserID) FROM [Mold].[MasterTechnician] WHERE UserID = ${UserID};
                IF(@CntTech IS NULL)
                BEGIN
                    INSERT INTO [Mold].[MasterTechnician](UserID) VALUES(${UserID});
                END;
                `;
                await pool.request().query(insertFilePath);

                let totalScore = await pool.request().query(`SELECT COUNT(a.TechSkillID) AS CntSkill, SUM(a.Score) AS Score FROM [TechSkill] a WHERE a.UserID = ${UserID};`);
                let SkillScore = !totalScore.recordset[0].CntSkill ? 0 : (totalScore.recordset[0].Score / totalScore.recordset[0].CntSkill);
                let updateScore = `DECLARE @UserID INT;
                SELECT @UserID = UserID FROM [Mold].[MasterTechnician] WHERE UserID = ${UserID};

                IF(@UserID IS NULL)
                BEGIN
                    INSERT INTO [Mold].[MasterTechnician](UserID, SkillScore) VALUES(${UserID}, ${SkillScore});
                END
                ELSE
                BEGIN
                    UPDATE [Mold].[MasterTechnician] SET SkillScore = ${SkillScore} WHERE UserID = @UserID;
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
        let pool = await getPool('MoldPool', config);
        let { DocumentName } = req.body;
        let DocCtrl = await pool.request().query(`SELECT DocumentID, DocumentCtrlNo, DocumentName
        FROM [Mold].[MasterDocumentCtrl]
        WHERE DocumentName = '${DocumentName}';
        `);
        res.json(DocCtrl.recordset)
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})
router.put('/docctrl/edit', async (req, res) => {
    try
    {
        let pool = await getPool('MoldPool', config);
        let { DocumentID, DocumentName, DocumentCtrlNo } = req.body;
        let updateDocCrtl = `
        DECLARE @DocumentID INT
        SET @DocumentID = (SELECT DocumentID FROM [Mold].[MasterDocumentCtrl] WHERE DocumentName = '${DocumentName}');

        IF(@DocumentID IS NULL)
	        BEGIN
		        INSERT INTO [Mold].[MasterDocumentCtrl] (DocumentCtrlNo, DocumentName) VALUES('${DocumentCtrlNo}', '${DocumentName}');
	        END
        ELSE
	        BEGIN
		        UPDATE [Mold].[MasterDocumentCtrl] SET DocumentCtrlNo = '${DocumentCtrlNo}', DocumentName = '${DocumentName}' WHERE DocumentID = @DocumentID;
	        END
        `;
        await pool.request().query(updateDocCrtl);
        res.json({ message: `Success` });
    }
    catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;