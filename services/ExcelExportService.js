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

    // static async generateUsersReport(reportData, options = {}) {
    //     const workbook = new ExcelJS.Workbook();

    //     // Set workbook properties
    //     workbook.creator = 'User Management System';
    //     workbook.lastModifiedBy = 'System';
    //     workbook.created = new Date();
    //     workbook.modified = new Date();

    //     // Create multiple worksheets
    //     // await this.createSummarySheet(workbook, reportData, options);
    //     await this.createDetailedUsersReportSheet(workbook, reportData.users || reportData, options);
    //     // await this.createLocationSummarySheet(workbook, reportData.summary, options);
    //     // await this.createHolidaySheet(workbook, reportData.users || reportData, options);
    //     // await this.createPolicySheet(workbook, reportData.users || reportData, options);

    //     return workbook;
    // }

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
        
        // Headers with comprehensive information
        const headers = [
            { header: 'Report Date', key: 'date_range', width: 15 },
            { header: 'Order ID', key: 'order_number', width: 15 },
            { header: 'Shipping Cost', key: 'shipping_cost', width: 25 },
            { header: 'Total', key: 'total', width: 20 },
            { header: 'Order status', key: 'status', width: 20 },
            { header: 'Payment Status', key: 'payment_status', width: 20 },
            { header: 'Payment Medium', key: 'payment_method', width: 20 },
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
                order_number: user?.order_number || 'N/A',
                shipping_cost: user.shipping_cost || 'N/A',
                total: user.total || 'N/A',
                status: user.status || 'N/A',
                payment_status: user.payment_status || 'N/A',
                payment_method: user.payment_method || 'N/A',
            };

            // Handle clock in/out times - ensure they exist and are arrays
            // const clockInTimes = Array.isArray(user.clock_in) ? user.clock_in : [];
           

            // Create a map for quick lookup of attendance data by date
            const orderByDate = {};




            // Create a row for each date in the range
            dateRange.forEach(date => {
                const attendance = orderByDate[date] || {};

                const rowData = {
                    ...baseRowData,
                    date_range: dayjs(date).format('DD-MM-YYYY'),
                    // present_days: attendance.clock_in ? "Present" : "Absent",
                
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
                // const presentCell = excelRow.getCell('present_days');
                // if (rowData.present_days === 'Present') {
                //     presentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E8' } };
                //     presentCell.font = { color: { argb: 'FF2E7D32' } };
                // } else {
                //     presentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEAEA' } };
                //     presentCell.font = { color: { argb: 'FFD32F2F' } };
                // }

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

    // Legacy method for backward compatibility
    static async generateExcel(data, options = {}) {
        return this.generateOrderReport({ users: data }, options);
    }

    // static async generateUsersExcel(data, options = {}) {
    //     return this.generateUsersReport({ users: data }, options);
    // }
}

module.exports = ExcelExportService;