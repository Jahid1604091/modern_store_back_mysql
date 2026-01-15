const ExcelJS = require('exceljs');
const dayjs = require('dayjs');

class ExcelExportService {
    static async generateOrderReport(reportData, options = {}) {
        const workbook = new ExcelJS.Workbook();

        // Set workbook properties
        workbook.creator = 'Order History';
        workbook.lastModifiedBy = 'Details';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Create multiple worksheets
        // await this.createSummarySheet(workbook, reportData, options);
        await this.createDetailedReportSheet(workbook, reportData.users || reportData, options);
        // await this.createLocationSummarySheet(workbook, reportData.summary, options);
        // await this.createHolidaySheet(workbook, reportData.users || reportData, options);
        // await this.createPolicySheet(workbook, reportData.users || reportData, options);

        return workbook;
    }

    static async generateUsersReport(reportData, options = {}) {
        const workbook = new ExcelJS.Workbook();

        // Set workbook properties
        workbook.creator = 'User Management System';
        workbook.lastModifiedBy = 'System';
        workbook.created = new Date();
        workbook.modified = new Date();

        // Create multiple worksheets
        // await this.createSummarySheet(workbook, reportData, options);
        await this.createDetailedUsersReportSheet(workbook, reportData.users || reportData, options);
        // await this.createLocationSummarySheet(workbook, reportData.summary, options);
        // await this.createHolidaySheet(workbook, reportData.users || reportData, options);
        // await this.createPolicySheet(workbook, reportData.users || reportData, options);

        return workbook;
    }

    static async createSummarySheet(workbook, reportData, options) {
        const worksheet = workbook.addWorksheet('Summary');
        const data = reportData.users || reportData;
        const summary = reportData.summary || {};

        // Title
        worksheet.mergeCells('A1:F3');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'ATTENDANCE REPORT SUMMARY';
        titleCell.font = { size: 18, bold: true, color: { argb: 'FF2F4F4F' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } };

        // Report info
        worksheet.getCell('A5').value = 'Report Period:';
        worksheet.getCell('B5').value = `${options.startDate} to ${options.endDate}`;
        worksheet.getCell('A6').value = 'Generated On:';
        worksheet.getCell('B6').value = dayjs().format('YYYY-MM-DD HH:mm:ss');
        worksheet.getCell('A7').value = 'Total Employees:';
        worksheet.getCell('B7').value = data.length;

        // Overall Statistics
        worksheet.getCell('A9').value = 'OVERALL STATISTICS';
        worksheet.getCell('A9').font = { bold: true, size: 14 };

        const overallStats = [
            ['Total Working Days', summary.overall?.total_working_days || 0],
            ['Total Present Days', summary.overall?.total_present_days || 0],
            ['Total Absent Days', summary.overall?.total_absent_days || 0],
            ['Total Late Days', summary.overall?.total_late_days || 0],
            ['Average Attendance %', summary.overall?.average_attendance || '0.00'],
            ['Total Overtime (hours)', Math.round((summary.overall?.total_overtime_minutes || 0) / 60 * 100) / 100]
        ];

        let row = 10;
        overallStats.forEach(([label, value]) => {
            worksheet.getCell(`A${row}`).value = label;
            worksheet.getCell(`B${row}`).value = value;
            worksheet.getCell(`A${row}`).font = { bold: true };
            row++;
        });

        // Top Performers
        worksheet.getCell('A17').value = 'TOP PERFORMERS (95%+ Attendance)';
        worksheet.getCell('A17').font = { bold: true, size: 12, color: { argb: 'FF006400' } };

        const topPerformers = data
            .filter(user => parseFloat(user.attendance_percentage || user.present_percent) >= 95)
            .sort((a, b) => parseFloat(b.attendance_percentage || b.present_percent) - parseFloat(a.attendance_percentage || a.present_percent))
            .slice(0, 10);

        if (topPerformers.length > 0) {
            row = 18;
            topPerformers.forEach(user => {
                worksheet.getCell(`A${row}`).value = user.user_name;
                worksheet.getCell(`B${row}`).value = `${user.attendance_percentage || user.present_percent}%`;
                worksheet.getCell(`B${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4F4DD' } };
                row++;
            });
        } else {
            worksheet.getCell('A18').value = 'No employees with 95%+ attendance';
        }

        // Poor Performers
        const poorPerformersRow = Math.max(row + 2, 29);
        worksheet.getCell(`A${poorPerformersRow}`).value = 'ATTENTION REQUIRED (<60% Attendance)';
        worksheet.getCell(`A${poorPerformersRow}`).font = { bold: true, size: 12, color: { argb: 'FFDC143C' } };

        const poorPerformers = data
            .filter(user => parseFloat(user.attendance_percentage || user.present_percent) < 60)
            .sort((a, b) => parseFloat(a.attendance_percentage || a.present_percent) - parseFloat(b.attendance_percentage || b.present_percent))
            .slice(0, 10);

        if (poorPerformers.length > 0) {
            let poorRow = poorPerformersRow + 1;
            poorPerformers.forEach(user => {
                worksheet.getCell(`A${poorRow}`).value = user.user_name;
                worksheet.getCell(`B${poorRow}`).value = `${user.attendance_percentage || user.present_percent}%`;
                worksheet.getCell(`B${poorRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
                poorRow++;
            });
        } else {
            worksheet.getCell(`A${poorPerformersRow + 1}`).value = 'No employees with <60% attendance';
        }

        // Set column widths
        worksheet.getColumn('A').width = 30;
        worksheet.getColumn('B').width = 20;
    }

    static async createDetailedReportSheet(workbook, data, options) {
        const worksheet = workbook.addWorksheet('Detailed Report');
        console.log(data);
        // Headers with comprehensive information
        const headers = [
            { header: 'Report Date', key: 'date_range', width: 15 },
            { header: 'Employee ID', key: 'employee_id', width: 15 },
            { header: 'Employee Name', key: 'user_name', width: 25 },
            { header: 'Region', key: 'location_name', width: 20 },
            { header: 'Area', key: 'area_name', width: 20 },
            { header: 'RFF Point', key: 'rff_name', width: 20 },
            { header: 'Designation', key: 'designation_name', width: 20 },
            { header: 'Status', key: 'present_days', width: 15 },
            { header: 'Fingerprint Enrolled?', key: 'fingerprint', width: 30 },
            { header: 'In Time', key: 'clock_in', width: 30 },
            { header: 'Out Time', key: 'clock_out', width: 30 },
            { header: 'IsManual?', key: 'isManual', width: 30 },
            { header: 'In Location', key: 'attendance_in_location', width: 30 },
            { header: 'Out Location', key: 'attendance_out_location', width: 30 },
            { header: 'In Remarks', key: 'in_remarks', width: 30 },
            { header: 'Out Remarks', key: 'out_remarks', width: 30 }
        ];

        worksheet.columns = headers;

        // Style header row

        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Add borders to header
        headerRow.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Generate array of dates between start and end date
        const generateDateRange = (startDate, endDate) => {
            const dates = [];
            const currentDate = dayjs(startDate);
            const endDateObj = dayjs(endDate);

            let tempDate = currentDate;
            while (tempDate.isSameOrBefore(endDateObj, 'day')) {
                dates.push(tempDate.format('YYYY-MM-DD'));
                tempDate = tempDate.add(1, 'day');
            }

            return dates;
        };

        // Get date range from options
        const dateRange = generateDateRange(options?.startDate, options?.endDate);


        // Process and add data
        data.forEach((user) => {
            const baseRowData = {
                employee_id: user?.employee_id || 'N/A',
                user_name: user.user_name || 'N/A',
                location_name: user.location_name || 'N/A',
                area_name: user.area_name || 'N/A',
                rff_name: user.rff_name || 'N/A',
                designation_name: user.designation_name || 'N/A',
                fingerprint: user.hasFingerprint ? "Yes" : "No",
            };

            // Handle clock in/out times - ensure they exist and are arrays
            const clockInTimes = Array.isArray(user.clock_in) ? user.clock_in : [];
            const clockOutTimes = Array.isArray(user.clock_out) ? user.clock_out : [];
            const isManuals = Array.isArray(user.isManual) ? user.isManual : [];
            const clockInLocations = Array.isArray(user.attendance_in_location) ? user.attendance_in_location : [];
            const clockOutLocations = Array.isArray(user.attendance_out_location) ? user.attendance_out_location : [];
            const inRemarks = Array.isArray(user.in_remarks) ? user.in_remarks : [];
            const outRemarks = Array.isArray(user.out_remarks) ? user.out_remarks : [];

            // Create a map for quick lookup of attendance data by date
            const attendanceByDate = {};

            // Map clock in times by date
            clockInTimes.forEach((clockIn, index) => {
                if (clockIn) {
                    const date = dayjs(clockIn).format('YYYY-MM-DD');
                    if (!attendanceByDate[date]) {
                        attendanceByDate[date] = {};
                    }
                    attendanceByDate[date].clock_in = clockIn;
                }

                //for manuals
                if (isManuals[index]) {
                    const date = dayjs(clockIn).format('YYYY-MM-DD');
                    if (!attendanceByDate[date]) {
                        attendanceByDate[date] = {};
                    }
                    attendanceByDate[date].isManual = true;
                    attendanceByDate[date].attendance_in_location = clockInLocations[index];
                    attendanceByDate[date].attendance_out_location = clockOutLocations[index];
                    attendanceByDate[date].in_remarks = inRemarks[index];
                    attendanceByDate[date].out_remarks = outRemarks[index];

                }
            });

            // Map clock out times by date
            clockOutTimes.forEach((clockOut, index) => {
                if (clockOut) {
                    const date = dayjs(clockOut).format('YYYY-MM-DD');
                    if (!attendanceByDate[date]) {
                        attendanceByDate[date] = {};
                    }
                    attendanceByDate[date].clock_out = clockOut;
                }
            });



            // Create a row for each date in the range
            dateRange.forEach(date => {
                const attendance = attendanceByDate[date] || {};

                const rowData = {
                    ...baseRowData,
                    date_range: dayjs(date).format('DD-MM-YYYY'),
                    present_days: attendance.clock_in ? "Present" : "Absent",
                    clock_in: attendance.clock_in ? dayjs(attendance.clock_in).format('HH:mm:ss') : 'N/A',
                    clock_out: attendance.clock_out ? dayjs(attendance.clock_out).format('HH:mm:ss') : 'N/A',
                    isManual: attendance.isManual ? "Yes" : "No",
                    attendance_in_location: attendance.attendance_in_location || 'N/A',
                    attendance_out_location: attendance.attendance_out_location || 'N/A',
                    in_remarks: attendance.in_remarks || 'N/A',
                    out_remarks: attendance.out_remarks || 'N/A',
                };

                // Ensure all required fields have values
                Object.keys(rowData).forEach(key => {
                    if (rowData[key] === undefined || rowData[key] === null) {
                        rowData[key] = 'N/A';
                    }
                });

                const excelRow = worksheet.addRow(rowData);
                excelRow.height = 20;

                // Add conditional formatting for better visualization
                const presentCell = excelRow.getCell('present_days');
                if (rowData.present_days === 'Present') {
                    presentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
                    presentCell.font = { color: { argb: 'FF2E7D32' } };
                } else {
                    presentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAEA' } };
                    presentCell.font = { color: { argb: 'FFD32F2F' } };
                }

                // Add borders to all cells
                excelRow.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                });
            });
        });

        // Calculate total rows for autofilter (header + data rows)
        const totalRows = worksheet.rowCount;
        const totalCols = headers.length;
        const lastColumn = String.fromCharCode(65 + totalCols - 1); // Convert to Excel column letter

        // Add autofilter
        worksheet.autoFilter = {
            from: 'A1',
            to: `${lastColumn}${totalRows}`
        };

        // Freeze first row
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    //for user data
    static async createDetailedUsersReportSheet(workbook, data, options) {
        const worksheet = workbook.addWorksheet('Detailed Report');

        // Headers with comprehensive information
        const headers = [
            { header: 'Employee ID', key: 'employee_id', width: 15 },
            { header: 'Employee Name', key: 'user_name', width: 25 },
            { header: 'Region', key: 'location_name', width: 20 },
            { header: 'Area', key: 'area_name', width: 20 },
            { header: 'Rff Point', key: 'rff_name', width: 20 },
            { header: 'Designation', key: 'designation_name', width: 20 },
            { header: 'Fingerprint Enrolled?', key: 'fingerprint', width: 30 },
            { header: 'Status', key: 'status', width: 20 },
        ];

        worksheet.columns = headers;

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.height = 25;
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        // Add borders to header
        headerRow.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Process and add data
        data.forEach((user, index) => {
            // const avgLateMinutes = user.late_days > 0 ? Math.round(user.total_late_minutes / user.late_days) : 0;
            // const overtimeHours = Math.round((user.total_overtime_minutes || 0) / 60 * 100) / 100;
            // const attendancePercent = parseFloat(user.attendance_percentage || user.present_percent || 0);

            // let performanceStatus = 'Good';
            // if (attendancePercent >= 95) performanceStatus = 'Excellent';
            // else if (attendancePercent >= 85) performanceStatus = 'Good';
            // else if (attendancePercent >= 75) performanceStatus = 'Average';
            // else if (attendancePercent >= 60) performanceStatus = 'Below Average';
            // else performanceStatus = 'Poor';

            // const holidayDates = user.holidays ? user.holidays.join(', ') : '';

            const rowData = {
                employee_id: user?.employee_id || 'N/A',
                user_name: user.name,
                location_name: user.location_name,
                area_name: user.area_name,
                rff_name: user.rff_point_name,
                designation_name: user.designation_name,
                fingerprint: user.hasFingerprint ? "Yes" : "No",
                status: user.isActive ? "Active" : "Inactive",
            };

            const excelRow = worksheet.addRow(rowData);
            excelRow.height = 20;

            // Add borders to all cells
            excelRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', wrapText: true };
            });
        });

        // Add autofilter
        worksheet.autoFilter = {
            from: 'A1',
            to: `Q${data.length + 1}`
        };

        // Freeze first row
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }

    static async createLocationSummarySheet(workbook, summary, options) {
        const worksheet = workbook.addWorksheet('Location Summary');

        // Title
        worksheet.mergeCells('A1:F2');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'LOCATION-WISE ATTENDANCE SUMMARY';
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        if (summary && summary.by_location && summary.by_location.length > 0) {
            // Headers
            const headers = [
                { header: 'Location Name', key: 'name', width: 25 },
                { header: 'Employee Count', key: 'user_count', width: 18 },
                { header: 'Total Working Days', key: 'total_working_days', width: 20 },
                { header: 'Total Present Days', key: 'total_present_days', width: 20 },
                { header: 'Total Absent Days', key: 'total_absent_days', width: 20 },
                { header: 'Average Attendance %', key: 'average_attendance', width: 22 }
            ];

            worksheet.getRow(4).values = headers.map(h => h.header);
            worksheet.columns = headers;

            // Style header
            const headerRow = worksheet.getRow(4);
            headerRow.font = { bold: true };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };

            // Add data
            summary.by_location.forEach((location, index) => {
                const row = worksheet.addRow({
                    name: location.name,
                    user_count: location.user_count,
                    total_working_days: location.total_working_days,
                    total_present_days: location.total_present_days,
                    total_absent_days: location.total_absent_days,
                    average_attendance: `${location.average_attendance}%`
                });

                // Color coding for attendance percentage
                const avgAttendance = parseFloat(location.average_attendance);
                const attendanceCell = row.getCell('average_attendance');

                if (avgAttendance >= 90) {
                    attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4F4DD' } };
                } else if (avgAttendance >= 80) {
                    attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAA7' } };
                } else if (avgAttendance < 70) {
                    attendanceCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
                }
            });
        } else {
            worksheet.getCell('A4').value = 'No location data available';
        }

        // Area Summary
        if (summary && summary.by_area && summary.by_area.length > 0) {
            worksheet.getCell('A' + (summary.by_location.length + 7)).value = 'AREA-WISE SUMMARY';
            worksheet.getCell('A' + (summary.by_location.length + 7)).font = { bold: true, size: 14 };

            const areaStartRow = summary.by_location.length + 9;
            worksheet.getRow(areaStartRow).values = ['Area Name', 'Employee Count', 'Total Working Days', 'Total Present Days', 'Total Absent Days', 'Average Attendance %'];

            summary.by_area.forEach((area, index) => {
                worksheet.addRow([
                    area.name,
                    area.user_count,
                    area.total_working_days,
                    area.total_present_days,
                    area.total_absent_days,
                    `${area.average_attendance}%`
                ]);
            });
        }
    }

    static async createHolidaySheet(workbook, data, options) {
        const worksheet = workbook.addWorksheet('Holiday Analysis');

        // Title
        worksheet.getCell('A1').value = 'HOLIDAY ANALYSIS';
        worksheet.getCell('A1').font = { size: 16, bold: true };

        // Collect all unique holidays
        const holidayMap = new Map();
        data.forEach(user => {
            if (user.holidays && user.holidays.length > 0) {
                user.holidays.forEach(holiday => {
                    if (!holidayMap.has(holiday)) {
                        holidayMap.set(holiday, {
                            date: holiday,
                            employees: []
                        });
                    }
                    holidayMap.get(holiday).employees.push(user.user_name);
                });
            }
        });

        if (holidayMap.size > 0) {
            // Headers
            worksheet.getRow(3).values = ['Holiday Date', 'Employee Count', 'Employees'];
            worksheet.getRow(3).font = { bold: true };

            // Sort holidays by date
            const sortedHolidays = Array.from(holidayMap.values()).sort((a, b) =>
                new Date(a.date) - new Date(b.date)
            );

            let row = 4;
            sortedHolidays.forEach(holiday => {
                worksheet.getCell(`A${row}`).value = holiday.date;
                worksheet.getCell(`B${row}`).value = holiday.employees.length;
                worksheet.getCell(`C${row}`).value = holiday.employees.join(', ');
                row++;
            });

            // Set column widths
            worksheet.getColumn('A').width = 15;
            worksheet.getColumn('B').width = 18;
            worksheet.getColumn('C').width = 50;
        } else {
            worksheet.getCell('A3').value = 'No holidays recorded for this period';
        }
    }

    static async createPolicySheet(workbook, data, options) {
        const worksheet = workbook.addWorksheet('Policy Information');

        worksheet.getCell('A1').value = 'ATTENDANCE POLICY INFORMATION';
        worksheet.getCell('A1').font = { size: 16, bold: true };

        // Legend
        worksheet.getCell('A3').value = 'Performance Legend:';
        worksheet.getCell('A3').font = { bold: true };

        const legend = [
            ['Excellent', '95% and above', 'Green'],
            ['Good', '85% - 94%', 'Light Green'],
            ['Average', '75% - 84%', 'Yellow'],
            ['Below Average', '60% - 74%', 'Orange'],
            ['Poor', 'Below 60%', 'Red']
        ];

        legend.forEach((item, index) => {
            const row = 4 + index;
            worksheet.getCell(`A${row}`).value = item[0];
            worksheet.getCell(`B${row}`).value = item[1];
            worksheet.getCell(`C${row}`).value = item[2];

            // Color the cells according to legend
            const colorMap = {
                'Green': 'FFD4F4DD',
                'Light Green': 'FFE8F5E8',
                'Yellow': 'FFFFEAA7',
                'Orange': 'FFFFCC99',
                'Red': 'FFFFCCCC'
            };

            if (colorMap[item[2]]) {
                worksheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorMap[item[2]] } };
            }
        });

        // Additional information
        worksheet.getCell('A11').value = 'Report Notes:';
        worksheet.getCell('A11').font = { bold: true };

        const notes = [
            '• Working days exclude weekends and assigned holidays',
            '• Late days count any day with late arrival beyond grace period',
            '• Overtime is calculated beyond threshold time',
            '• Attendance percentage = (Present Days / Total Working Days) × 100'
        ];

        notes.forEach((note, index) => {
            worksheet.getCell(`A${12 + index}`).value = note;
        });

        // Set column widths
        worksheet.getColumn('A').width = 30;
        worksheet.getColumn('B').width = 20;
        worksheet.getColumn('C').width = 15;
    }

    // Legacy method for backward compatibility
    static async generateExcel(data, options = {}) {
        return this.generateOrderReport({ users: data }, options);
    }

    static async generateUsersExcel(data, options = {}) {
        return this.generateUsersReport({ users: data }, options);
    }
}

module.exports = ExcelExportService;