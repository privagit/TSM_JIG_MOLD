const express = require('express');
const router = express.Router();
const config = require('../../lib/dbconfig').dbconfig_mold;
const { getPool } = require('../../middlewares/pool-manager');


//* ========== Machine Run Plan ==========
router.post('/', async (req, res) => { //TODO: Map Bom BasicMold to MasterMold
    try {
        let pool = await getPool('MoldPool', config);
        let { month, year } = req.body;

        let machines = await pool.request().query(`SELECT d.EmMachineID, c.MachineID, c.MachineNo, c.MCSize, c.ZoneID, MAX(b.D1) AS D1, MAX(b.D2) AS D2, MAX(b.D3) AS D3, MAX(b.D4) AS D4,
		MAX(b.D5) AS D5, MAX(b.D6) AS D6, MAX(b.D7) AS D7, MAX(b.D8) AS D8, MAX(b.D9) AS D9, MAX(b.D10) AS D10, MAX(b.D11) AS D11,
		MAX(b.D12) AS D12, MAX(b.D13) AS D13, MAX(b.D14) AS D14, MAX(b.D15) AS D15, MAX(b.D16) AS D16, MAX(b.D17) AS D17, MAX(b.D18) AS D18,
		MAX(b.D19) AS D19, MAX(b.D20) AS D20, MAX(b.D21) AS D21, MAX(b.D22) AS D22, MAX(b.D23) AS D23, MAX(b.D24) AS D24, MAX(b.D25) AS D25,
		MAX(b.D26) AS D26, MAX(b.D27) AS D27, MAX(b.D28) AS D28, MAX(b.D29) AS D29, MAX(b.D30) AS D30, MAX(b.D31) AS D31
		FROM [TSMolymer_F].[Planner].[Plan_Inject] a
		LEFT JOIN [TSMolymer_F].[Planner].[Inject_Inj_Sheet] b ON a.Planning_No = b.Planning_No AND b.ItemId = 1
		LEFT JOIN [TSMolymer_F].[dbo].[MasterMachine] c ON a.Machine_No = c.MachineNo
        LEFT JOIN [Em].[MasterEmMachine] d ON d.MachineID = c.MachineID
		WHERE RIGHT(a.Planning_No, 5) = '${('00'+month).substr(-2)}-${year.substr(-2)}' AND d.Active = 1
		GROUP BY c.MachineID, c.MachineNo, c.MCSize, c.ZoneID, d.EmMachineID
		ORDER BY c.ZoneID, c.MachineNo
        `);
        let pmRequest = await pool.request().query(`
        WITH EmMachine AS (
            SELECT a.PreventPlanID, a.EmMachineID, a.AccessoryID, a.MachineTypeID, a.PlanType, a.PlanTime, DAY(a.PlanTime) AS D
            FROM [Em].[PreventPlan] a
            INNER JOIN [Em].[MasterEmMachine] b ON a.EmMachineID = b.EmMachineID
            WHERE a.EmMachineID IS NOT NULL AND MONTH(a.PlanTime) = ${month} AND YEAR(a.PlanTime) = ${year}
        ), AccMachine AS (
            SELECT a.PreventPlanID, a.EmMachineID, a.AccessoryID, a.MachineTypeID, a.PlanType, a.PlanTime, DAY(a.PlanTime) AS D
            FROM [Em].[PreventPlan] a
            INNER JOIN [Em].[MasterAccessory] b ON a.AccessoryID= b.AccessoryID
            WHERE a.EmMachineID IS NOT NULL AND MONTH(a.PlanTime) = ${month} AND YEAR(a.PlanTime) = ${year}
        )
        SELECT PreventPlanID, EmMachineID, AccessoryID, MachineTypeID, PlanType, PlanTime, D FROM [EmMachine]
        UNION ALL
        SELECT PreventPlanID, EmMachineID, AccessoryID, MachineTypeID, PlanType, PlanTime, D FROM [AccMachine]
        `);

        //* Filter Zone
        if(ZoneID){ //* Zone All = null
            machines.recordset = machines.recordset.filter(v => v.ZoneID == ZoneID);
        }

        await Promise.all(machines.recordset.map(async (mc) => {
            for(let key in mc){
                if(key == 'MachineID' || key == 'MachineNo' || key == 'MCSize' || key == 'ZoneID' || key == 'EmMachineID') continue;

                // 0: no plan, 1: plan
                mc[key] = !mc[key] ? 0 : 1;
            }

            let pm = pmRequest.recordset.filter(v => v.EmMachineID == mc.EmMachineID && v.AccessoryID == mc.AccessoryID);
            await Promise.all(pm.map(async (item) => {
                // 4: no plan, 5: plan
                mc[`D${item.D}`] = !mc[`D${item.D}`] ? 2 : 3;
            }));
        }));

        res.json(machines.recordset);
    } catch (err) {
        console.log(req.url, err);
        res.status(500).send({ message: `${err}` });
    }
})

module.exports = router;