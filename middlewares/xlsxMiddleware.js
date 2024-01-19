const fs = require('fs');

const writeFile = async (workbook, filename) => {
    try {
        await workbook.toFileAsync(`public/Report/temporary/${filename}`);
    } catch (err) {
        console.log(err);
    }
}

const fillDataTemplate = async (worksheet, sheetData, range) => {
    try {
        let r = await worksheet.range(range);
        let rowStart = r._minRowNumber;
        let rowEnd = r._maxRowNumber;
        let colStart = r._minColumnNumber;
        let colEnd = r._maxColumnNumber;
        let fillRange = await worksheet.range(rowStart, colStart, rowEnd, colEnd);
        fillRange.value(sheetData);
    } catch (err) {
        console.log(err);
        throw err;
    }
}

const fillDataTemplateRange = async (worksheet, sheetData, rowStart, rowEnd, colStart, colEnd) => {
    try {
        // let r = await worksheet.range(range);
        // let rowStart = r._minRowNumber;
        // let rowEnd = r._maxRowNumber;
        // let colStart = r._minColumnNumber;
        // let colEnd = r._maxColumnNumber;
        let fillRange = await worksheet.range(rowStart, colStart, rowEnd, colEnd);
        fillRange.value(sheetData);
    } catch (err) {
        console.log(err);
    }
}

const copyRow = async (worksheet, round, range, startRow) => {
    try {
        const r = worksheet.range(range);
        let srcRowStart = r._minRowNumber;
        let srcColStart = r._minColumnNumber;
        let srcRowEnd = r._maxRowNumber;
        let srcColEnd = r._maxColumnNumber;
        let rowRange = srcRowEnd - srcRowStart + 1;
        let templateRange = await worksheet.range(srcRowStart, srcColStart, srcRowEnd, srcColEnd);

        //copy
        let templateValues = await templateRange.value()
        let style = [];
        for(let i = srcRowStart; i <= srcRowEnd; i++){
            let row = [];
            for(let j = srcColStart; j <= srcColEnd; j ++){
                let styleID = worksheet.row(i).cell(j)._styleId;
                row.push(styleID);
            }
            style.push(row);
        }
        let templateRowHeights = []
        for (let i = srcRowStart; i <= srcRowEnd; i++) {
            templateRowHeights.push(worksheet.row(i).height());
        }
        templateValues = templateValues.map(v => v.map(elm => elm || null));

        // paste
        for (let i = 0; i < round; i++) {
            let destRowStart = startRow + (rowRange * i);
            let destColStart = srcColStart;
            let rowCount = srcRowEnd - srcRowStart + 1;
            let colCount = srcColEnd - srcColStart + 1;
            let cellRange = await worksheet.range(destRowStart, destColStart, destRowStart + rowCount - 1, destColStart + colCount - 1);

            await cellRange.value(templateValues);
            // await cellRange.style(templateStyles);

            //* loop row
            let indexStyleRow = 0;
            for(let i = destRowStart; i <= (destRowStart + rowCount - 1); i++){
                let row = i;
                let indexStyleCol = 0;
                //* loop cell
                for(let j = destColStart; j <= (destColStart + colCount - 1); j++){
                    let styleID = style[indexStyleRow][indexStyleCol];
                    worksheet.row(row).cell(j)._styleId = styleID;
                    indexStyleCol++;
                }
                indexStyleRow++;
            }

            for (let i = 0; i < rowCount; i++) {
                await worksheet.row(destRowStart + i).height(templateRowHeights[i]);
            }
        }

    } catch (err) {
        console.log(err);
    }
}

const copyRowRange = async (worksheet, round, tempRowStart, tempRowEnd, tempColStart, tempColEnd, startRow) => {
    try {
        let srcRowStart = tempRowStart;
        let srcColStart = tempColStart;
        let srcRowEnd = tempRowEnd;
        let srcColEnd = tempColEnd;
        let rowRange = srcRowEnd - srcRowStart + 1;
        let templateRange = await worksheet.range(srcRowStart, srcColStart, srcRowEnd, srcColEnd);

        //copy
        let templateValues = await templateRange.value()
        let style = [];
        for(let i = srcRowStart; i <= srcRowEnd; i++){
            let row = [];
            for(let j = srcColStart; j <= srcColEnd; j ++){
                let styleID = worksheet.row(i).cell(j)._styleId;
                row.push(styleID);
            }
            style.push(row);
        }
        let templateRowHeights = []
        for (let i = srcRowStart; i <= srcRowEnd; i++) {
            templateRowHeights.push(worksheet.row(i).height());
        }
        templateValues = templateValues.map(v => v.map(elm => elm || null));

        // paste
        for (let i = 0; i < round; i++) {
            let destRowStart = startRow + (rowRange * i);
            let destColStart = srcColStart;
            let rowCount = srcRowEnd - srcRowStart + 1;
            let colCount = srcColEnd - srcColStart + 1;
            let cellRange = await worksheet.range(destRowStart, destColStart, destRowStart + rowCount - 1, destColStart + colCount - 1);

            await cellRange.value(templateValues);
            // await cellRange.style(templateStyles);

            //* loop row
            let indexStyleRow = 0;
            for(let i = destRowStart; i <= (destRowStart + rowCount - 1); i++){
                let row = i;
                let indexStyleCol = 0;
                //* loop cell
                for(let j = destColStart; j <= (destColStart + colCount - 1); j++){
                    let styleID = style[indexStyleRow][indexStyleCol];
                    worksheet.row(row).cell(j)._styleId = styleID;
                    indexStyleCol++;
                }
                indexStyleRow++;
            }

            for (let i = 0; i < rowCount; i++) {
                await worksheet.row(destRowStart + i).height(templateRowHeights[i]);
            }
        }

    } catch (err) {
        console.log(err);
    }
}

const copyColumn = async (worksheet, round, range, startCol) => {
    try {
        const r = worksheet.range(range);
        let srcRowStart = r._minRowNumber;
        let srcColStart = r._minColumnNumber;
        let srcRowEnd = r._maxRowNumber;
        let srcColEnd = r._maxColumnNumber;
        let colRange = srcColEnd - srcColStart + 1;
        let templateRange = await worksheet.range(srcRowStart, srcColStart, srcRowEnd, srcColEnd);

        //copy
        let templateValues = await templateRange.value();
        let templateStyles = await templateRange.style([
            'bold',
            'fontSize',
            'fontFamily',
            'fontColor',
            'horizontalAlignment',
            'verticalAlignment',
            'wrapText',
            'fill',
            'border',
            'numberFormat',
            'rotateTextUp',
        ]);

        // paste
        for (let i = 0; i < round; i++) {
            let destColStart = startCol + (colRange * i)
            let destRowStart = srcRowStart;
            let rowCount = srcRowEnd - srcRowStart + 1;
            let colCount = srcColEnd - srcColStart + 1;

            let cellRange = await worksheet.range(destRowStart, destColStart, destRowStart + rowCount - 1, destColStart + colCount - 1);

            await cellRange.value(templateValues);
            await cellRange.style(templateStyles);
        }
    } catch (err) {
        console.log('copyColumn', err);
        throw err;
    }
}

const copyColumnRange = async (worksheet, round, tempRowStart, tempRowEnd, tempColStart, tempColEnd, startCol) => {
    try {
        let srcRowStart = tempRowStart;
        let srcColStart = tempColStart;
        let srcRowEnd = tempRowEnd;
        let srcColEnd = tempColEnd;
        let colRange = srcColEnd - srcColStart + 1;
        let templateRange = await worksheet.range(srcRowStart, srcColStart, srcRowEnd, srcColEnd);

        //copy
        let templateValues = await templateRange.value();
        let templateStyles = await templateRange.style([
            'bold',
            'fontSize',
            'fontFamily',
            'fontColor',
            'horizontalAlignment',
            'verticalAlignment',
            'wrapText',
            'fill',
            'border',
            'numberFormat',
            'rotateTextUp',
        ]);

        // paste
        for (let i = 0; i < round; i++) {
            let destColStart = startCol + (colRange * i)
            let destRowStart = srcRowStart;
            let rowCount = srcRowEnd - srcRowStart + 1;
            let colCount = srcColEnd - srcColStart + 1;

            let cellRange = await worksheet.range(destRowStart, destColStart, destRowStart + rowCount - 1, destColStart + colCount - 1);

            await cellRange.value(templateValues);
            await cellRange.style(templateStyles);
        }
    } catch (err) {
        console.log('copyColumn', err);
        throw err;
    }
}

const mergeReportProblem = async (worksheet, ProblemLen, McGroupLen, year) => {
    try {
        let MonthMap = { 0: `Year ${year}`, 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' };
        for(let i = 0; i < 13; i++){ // year, 1-12 month
            let START_ROW = 2 + ((6 + ProblemLen) * i);
            let COL_No = 1;
            let COL_Problem = 2;

            // Merge No.
            let NoRange = await worksheet.range(START_ROW, COL_No, START_ROW + 2, COL_No);
            await NoRange.merged(true);

            // Merge Problem
            let ProblemRange = await worksheet.range(START_ROW, COL_Problem, START_ROW + 2, COL_Problem);
            await ProblemRange.merged(true);

            for(let j = 0; j < McGroupLen + 1; j++){ // MachineGroup
                let START_COL_GroupHeader = 3 + (3 * j);
                let END_COL_GroupHeader = START_COL_GroupHeader + 2;
                let groupHeader = await worksheet.range(START_ROW + 1, START_COL_GroupHeader, START_ROW + 1, END_COL_GroupHeader);
                await groupHeader.merged(true);
            }

            worksheet.row(START_ROW).cell(3).value(MonthMap[i]);// Year, Month Value
            worksheet.row(START_ROW).cell(3).style({ horizontalAlignment: 'center', verticalAlignment: 'center' });
            let START_COL_yearMonth = 3;
            let END_COL_yearMonth = 3 + (3 * (McGroupLen + 1)) - 1;
            let yearMonthHeader = await worksheet.range(START_ROW, START_COL_yearMonth, START_ROW, END_COL_yearMonth); // Year, Month
            await yearMonthHeader.merged(true);
        }
    } catch (err) {
        console.log('mergeReportProblem', err);
        throw err;
    }
}

const checkFileExistence = async (filePath) => {
    try {
        await fs.access(filePath, fs.constants.F_OK);
        return true;
      } catch (err) {
        return false;
      }
}

module.exports = {
    writeFile,
    fillDataTemplate,
    fillDataTemplateRange,
    copyRow,
    copyRowRange,
    copyColumn,
    copyColumnRange,
    mergeReportProblem,
    checkFileExistence
}