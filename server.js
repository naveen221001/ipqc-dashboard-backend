// server.js - Updated with proper CORS configuration
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const XLSX = require('xlsx');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration - UPDATED TO FIX THE ISSUE
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'https://quality-dashboard-naveen.netlify.app',
    'https://*.netlify.app',
    process.env.FRONTEND_URL
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // For legacy browser support
};

// Middleware - UPDATED ORDER
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(cors(corsOptions)); // CORS before other middleware
app.use(express.json());

// Handle preflight requests
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('Origin')}`);
  next();
});

// In-memory cache
let dataCache = {
  data: null,
  lastUpdated: null,
  cacheExpiry: 5 * 60 * 1000 // 5 minutes
};

// Excel file path
const EXCEL_FILE_PATH = path.join(__dirname, 'data', 'IPQC_Peel_Strength.xlsx');

// Helper function to check if cache is valid
const isCacheValid = () => {
  return dataCache.data && dataCache.lastUpdated && 
         (Date.now() - dataCache.lastUpdated) < dataCache.cacheExpiry;
};

// Helper function to parse Excel data according to your structure
const parseExcelData = () => {
  try {
    console.log('Parsing Excel file:', EXCEL_FILE_PATH);
    
    if (!fs.existsSync(EXCEL_FILE_PATH)) {
      console.error('Excel file not found:', EXCEL_FILE_PATH);
      return null;
    }

    const workbook = XLSX.readFile(EXCEL_FILE_PATH);
    console.log('Available sheets:', workbook.SheetNames);
    
    // Focus on Phase 2 sheet
    const phase2SheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('phase 2') || 
      name.toLowerCase().includes('phase2') ||
      name.toLowerCase().includes('stringer 7') // fallback
    );
    
    if (!phase2SheetName) {
      console.error('Phase 2 sheet not found. Available sheets:', workbook.SheetNames);
      return null;
    }
    
    console.log('Using sheet:', phase2SheetName);
    const worksheet = workbook.Sheets[phase2SheetName];
    
    // Convert sheet to JSON with header row
    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use array of arrays
      range: 6, // Start from row 6 (0-indexed, so this is row 7)
      defval: '' // Default value for empty cells
    });
    
    console.log('Raw data rows:', rawData.length);
    
    if (rawData.length === 0) {
      console.error('No data found in Excel sheet');
      return null;
    }
    
    // Process the data according to your structure
    const processedData = processIPQCData(rawData);
    
    console.log('Successfully parsed Excel data');
    console.log('Processed data summary:', {
      totalRecords: processedData.length,
      dateRange: processedData.length > 0 ? {
        start: processedData[0]?.date,
        end: processedData[processedData.length - 1]?.date
      } : null
    });
    
    return processedData;
    
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    return null;
  }
};

// Process IPQC data according to your exact structure
const processIPQCData = (rawData) => {
  const processedData = [];
  const stringers = [7, 8, 9, 10, 11, 12]; // Phase 2 stringers
  
  // Calculate how many days of data we have
  // Each day = 204 rows (3 shifts × 68 rows per shift)
  const totalRows = rawData.length;
  const rowsPerDay = 204; // As per your structure: rows 6-209 = 204 rows
  const totalDays = Math.floor(totalRows / rowsPerDay);
  
  console.log(`Processing ${totalDays} days of data (${totalRows} total rows)`);
  
  for (let day = 0; day < totalDays; day++) {
    const dayStartRow = day * rowsPerDay;
    const dayData = rawData.slice(dayStartRow, dayStartRow + rowsPerDay);
    
    // Extract date from the first row of the day
    const dateCell = dayData[0]?.[1]; // Column B
    let date = null;
    
    if (dateCell) {
      // Try to parse date in various formats
      if (typeof dateCell === 'number') {
        // Excel date serial number
        date = moment(XLSX.SSF.parse_date_code(dateCell)).format('YYYY-MM-DD');
      } else if (typeof dateCell === 'string') {
        // String date
        const parsedDate = moment(dateCell, ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']);
        if (parsedDate.isValid()) {
          date = parsedDate.format('YYYY-MM-DD');
        }
      }
    }
    
    // If we can't parse date, use sequential dates starting from May 1, 2025
    if (!date) {
      date = moment('2025-05-01').add(day, 'days').format('YYYY-MM-DD');
    }
    
    console.log(`Processing day ${day + 1}: ${date}`);
    
    // Process each stringer for this day
    stringers.forEach(stringerNum => {
      const stringerData = processStringerDay(dayData, date, stringerNum);
      if (stringerData.length > 0) {
        processedData.push(...stringerData);
      }
    });
  }
  
  return processedData;
};

// Process a single stringer for one day
const processStringerDay = (dayData, date, stringerNum) => {
  const stringerData = [];
  const shifts = ['A', 'B', 'C'];
  
  // Each shift has 68 rows (2 units × 2 parts × 16 rows + headers)
  const rowsPerShift = 68;
  
  shifts.forEach((shift, shiftIndex) => {
    const shiftStartRow = shiftIndex * rowsPerShift;
    const shiftData = dayData.slice(shiftStartRow, shiftStartRow + rowsPerShift);
    
    // Process units A and B for this shift
    ['A', 'B'].forEach((unit, unitIndex) => {
      const unitStartRow = unitIndex * 34; // Each unit has 34 rows (2 parts × 16 rows + headers)
      const unitData = shiftData.slice(unitStartRow, unitStartRow + 34);
      
      // Check for OFF condition in this unit
      const hasOffValue = unitData.some(row => 
        row.some(cell => cell && cell.toString().toUpperCase() === 'OFF')
      );
      
      if (hasOffValue) {
        console.log(`Skipping ${date} Stringer ${stringerNum} Shift ${shift} Unit ${unit} - OFF found`);
        return;
      }
      
      // Process Front and Back parts
      ['Front', 'Back'].forEach((part, partIndex) => {
        const partStartRow = partIndex * 17; // Each part has 16 data rows + 1 header
        const partData = unitData.slice(partStartRow + 1, partStartRow + 17); // Skip header row
        
        const rowAverages = [];
        const rowLabels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 
                          'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];
        
        // Process each row (L1-L8, R1-R8)
        partData.forEach((row, rowIndex) => {
          if (rowIndex < 16) { // Ensure we don't exceed 16 rows
            // Extract values from columns F to L (indices 5-11 in 0-based array)
            const values = [];
            for (let col = 5; col <= 10; col++) { // F=5, G=6, H=7, I=8, J=9, K=10
              const cellValue = row[col];
              if (cellValue !== undefined && cellValue !== null && cellValue !== '') {
                const numValue = parseFloat(cellValue);
                if (!isNaN(numValue)) {
                  values.push(numValue);
                }
              }
            }
            
            // Calculate row average if we have 6 values
            if (values.length === 6) {
              const rowAverage = values.reduce((sum, val) => sum + val, 0) / 6;
              rowAverages.push({
                label: rowLabels[rowIndex],
                values: values,
                average: rowAverage
              });
            }
          }
        });
        
        // Calculate part average if we have 16 row averages
        if (rowAverages.length === 16) {
          const partAverage = rowAverages.reduce((sum, row) => sum + row.average, 0) / 16;
          
          stringerData.push({
            id: `${date}-Phase2-${stringerNum}-${shift}-${unit}-${part}`,
            date: date,
            phase: 'Phase 2',
            stringer: stringerNum,
            shift: shift,
            unit: unit,
            part: part,
            average: partAverage,
            rowData: rowAverages,
            timestamp: new Date().toISOString()
          });
        }
      });
    });
  });
  
  return stringerData;
};

// Calculate comprehensive statistics
const calculateStatistics = (data) => {
  if (!data || data.length === 0) {
    return {
      avg: 0, min: 0, max: 0, std: 0, count: 0,
      cp: 0, cpk: 0, passRate: 0, outOfSpec: 0,
      capability: 'Unknown', trend: 0
    };
  }
  
  const values = data.map(d => d.average);
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // Standard deviation
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  // Process capability indices
  const upperSpec = 3.0;
  const lowerSpec = 2.0;
  const cp = (upperSpec - lowerSpec) / (6 * std);
  const cpk = Math.min((upperSpec - avg) / (3 * std), (avg - lowerSpec) / (3 * std));
  
  // Pass rate
  const passCount = values.filter(v => v >= lowerSpec && v <= upperSpec).length;
  const passRate = (passCount / values.length) * 100;
  const outOfSpec = values.length - passCount;
  
  // Capability assessment
  let capability = 'Poor';
  if (cpk >= 1.33) capability = 'Excellent';
  else if (cpk >= 1.0) capability = 'Good';
  else if (cpk >= 0.67) capability = 'Fair';
  
  return {
    avg, min, max, std, count: values.length,
    cp, cpk, passRate, outOfSpec, capability,
    trend: 0 // Will implement trend calculation later
  };
};

// Get or refresh data
const getData = () => {
  if (isCacheValid()) {
    console.log('Returning cached data');
    return dataCache.data;
  }
  
  console.log('Cache expired or empty, parsing Excel file');
  const data = parseExcelData();
  
  if (data) {
    dataCache.data = data;
    dataCache.lastUpdated = Date.now();
  }
  
  return data;
};

// API Routes

// Health check - UPDATED WITH CORS HEADERS
app.get('/api/health', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    cors: 'enabled',
    origin: req.get('Origin')
  });
});

// Get all Phase 2 data with filtering
app.get('/api/phase2/data', (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    
    const data = getData();
    
    if (!data) {
      return res.status(500).json({
        error: 'Failed to load data',
        message: 'Excel file not found or failed to parse'
      });
    }
    
    let filteredData = data;
    
    // Apply filters
    if (req.query.stringer) {
      filteredData = filteredData.filter(d => d.stringer === parseInt(req.query.stringer));
    }
    
    if (req.query.shift) {
      filteredData = filteredData.filter(d => d.shift === req.query.shift);
    }
    
    if (req.query.unit) {
      filteredData = filteredData.filter(d => d.unit === req.query.unit);
    }
    
    if (req.query.part) {
      filteredData = filteredData.filter(d => d.part === req.query.part);
    }
    
    if (req.query.startDate) {
      filteredData = filteredData.filter(d => d.date >= req.query.startDate);
    }
    
    if (req.query.endDate) {
      filteredData = filteredData.filter(d => d.date <= req.query.endDate);
    }
    
    const stats = calculateStatistics(filteredData);
    
    res.json({
      data: filteredData,
      statistics: stats,
      filters: req.query,
      totalRecords: filteredData.length,
      lastUpdated: dataCache.lastUpdated
    });
    
  } catch (error) {
    console.error('Error in /api/phase2/data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get daily averages
app.get('/api/phase2/daily-averages', (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    
    const data = getData();
    
    if (!data) {
      return res.status(500).json({
        error: 'Failed to load data'
      });
    }
    
    // Group data by date and calculate daily averages
    const dailyData = {};
    
    data.forEach(record => {
      if (!dailyData[record.date]) {
        dailyData[record.date] = {
          date: record.date,
          values: [],
          stringerAverages: {}
        };
      }
      
      dailyData[record.date].values.push(record.average);
      
      // Track stringer averages
      if (!dailyData[record.date].stringerAverages[record.stringer]) {
        dailyData[record.date].stringerAverages[record.stringer] = [];
      }
      dailyData[record.date].stringerAverages[record.stringer].push(record.average);
    });
    
    // Calculate averages
    const dailyAverages = Object.values(dailyData).map(day => {
      const dayAverage = day.values.reduce((sum, val) => sum + val, 0) / day.values.length;
      
      // Calculate individual stringer averages for this day
      const stringerAverages = {};
      Object.keys(day.stringerAverages).forEach(stringer => {
        const stringerValues = day.stringerAverages[stringer];
        stringerAverages[`Stringer ${stringer}`] = stringerValues.reduce((sum, val) => sum + val, 0) / stringerValues.length;
      });
      
      return {
        date: day.date,
        average: dayAverage,
        target: 2.5,
        upperLimit: 3.0,
        lowerLimit: 2.0,
        upperControl: 2.8,
        lowerControl: 2.2,
        dataPoints: day.values.length,
        ...stringerAverages
      };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.json({
      dailyAverages,
      totalDays: dailyAverages.length,
      dateRange: {
        start: dailyAverages[0]?.date,
        end: dailyAverages[dailyAverages.length - 1]?.date
      }
    });
    
  } catch (error) {
    console.error('Error in /api/phase2/daily-averages:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get stringer performance analysis
app.get('/api/phase2/stringers', (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    
    const data = getData();
    
    if (!data) {
      return res.status(500).json({
        error: 'Failed to load data'
      });
    }
    
    // Group data by stringer
    const stringerData = {};
    
    data.forEach(record => {
      if (!stringerData[record.stringer]) {
        stringerData[record.stringer] = {
          stringer: record.stringer,
          phase: record.phase,
          values: []
        };
      }
      stringerData[record.stringer].values.push(record.average);
    });
    
    // Calculate stringer statistics
    const stringerAnalysis = Object.values(stringerData).map(stringer => {
      const values = stringer.values;
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // Standard deviation
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      
      // Cpk calculation
      const upperSpec = 3.0;
      const lowerSpec = 2.0;
      const cpk = Math.min((upperSpec - avg) / (3 * std), (avg - lowerSpec) / (3 * std));
      
      return {
        name: `Stringer ${stringer.stringer}`,
        stringer: stringer.stringer,
        phase: stringer.phase,
        average: avg,
        min,
        max,
        std,
        cpk,
        target: 2.5,
        count: values.length,
        performance: avg >= 2.5 ? 'PASS' : 'REVIEW'
      };
    }).sort((a, b) => a.stringer - b.stringer);
    
    res.json({
      stringers: stringerAnalysis,
      summary: {
        totalStringers: stringerAnalysis.length,
        averagePerformance: stringerAnalysis.reduce((sum, s) => sum + s.average, 0) / stringerAnalysis.length,
        passingStringers: stringerAnalysis.filter(s => s.performance === 'PASS').length
      }
    });
    
  } catch (error) {
    console.error('Error in /api/phase2/stringers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Refresh data cache
app.post('/api/refresh', (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    
    console.log('Manual data refresh requested');
    dataCache.data = null;
    dataCache.lastUpdated = null;
    
    const data = getData();
    
    if (data) {
      res.json({
        message: 'Data refreshed successfully',
        recordCount: data.length,
        lastUpdated: dataCache.lastUpdated
      });
    } else {
      res.status(500).json({
        error: 'Failed to refresh data'
      });
    }
  } catch (error) {
    console.error('Error in /api/refresh:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get detailed record
app.get('/api/phase2/record/:id', (req, res) => {
  try {
    res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
    
    const data = getData();
    
    if (!data) {
      return res.status(500).json({
        error: 'Failed to load data'
      });
    }
    
    const record = data.find(r => r.id === req.params.id);
    
    if (!record) {
      return res.status(404).json({
        error: 'Record not found'
      });
    }
    
    res.json(record);
    
  } catch (error) {
    console.error('Error in /api/phase2/record:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} is not a valid endpoint`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 IPQC Dashboard Backend running on port ${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
  console.log(`📁 Excel file path: ${EXCEL_FILE_PATH}`);
  console.log(`🌐 CORS enabled for: ${corsOptions.origin.join(', ')}`);
  
  // Initial data load
  const initialData = getData();
  if (initialData) {
    console.log(`✅ Successfully loaded ${initialData.length} records`);
  } else {
    console.log(`⚠️  No data loaded - Excel file may not exist yet`);
  }
});

module.exports = app;
