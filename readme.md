# 🎯 IPQC Dashboard - Peel Strength Test Analysis

A comprehensive dashboard for analyzing IPQC (In-Process Quality Control) Peel Strength Test data with real-time monitoring, statistical analysis, and automated data synchronization from OneDrive.

## 🚀 Features

### 📊 **Dashboard Capabilities**
- **Real-time Data Visualization** - Interactive charts and graphs
- **Statistical Process Control** - Cp, Cpk, control limits, and capability analysis
- **Multi-level Filtering** - Phase, Stringer, Shift, Unit, Part, Date ranges
- **Trend Analysis** - Daily, weekly, and monthly trends
- **Performance Monitoring** - Individual stringer performance comparison
- **Quality Alerts** - Automatic detection of out-of-spec conditions

### 🔄 **Automated Data Pipeline**
- **OneDrive Integration** - Automatic Excel file synchronization
- **GitHub Actions** - Scheduled data updates every 2 hours
- **Real-time Processing** - Instant calculation of averages and statistics
- **Cache Management** - Optimized performance with intelligent caching

### 📈 **Advanced Analytics**
- **Process Capability Analysis** - Comprehensive Cp/Cpk calculations
- **Control Charts** - SPC charts with control limits
- **Performance Distribution** - Statistical distribution analysis
- **Rejection Analysis** - Stage-wise rejection tracking

## 🏗️ Architecture

```
OneDrive Excel File → GitHub Actions → GitHub Repository → Backend API → Frontend Dashboard
```

### **Frontend Stack**
- ⚛️ React 18 with Vite
- 🎨 Material-UI (MUI) with custom red/white theme
- 📊 Recharts for data visualization
- 📱 Responsive design for all devices

### **Backend Stack**
- 🟢 Node.js with Express.js
- 📊 XLSX library for Excel parsing
- 🚀 Deployed on Render
- 🔄 Automated data refresh from GitHub

## 📋 Data Structure

### **Excel File Format**
- **File**: `IPQC_Peel_Strength.xlsx`
- **Sheets**: Phase 1 (Stringers 1-6), Phase 2 (Stringers 7-12)
- **Focus**: Currently implementing Phase 2

### **Row Structure (Per Day)**
```
Rows 6-73:   Shift A (Unit A: Front 6-22, Back 23-39; Unit B: Front 40-56, Back 57-73)
Rows 74-141: Shift B (Same structure as Shift A)
Rows 142-209: Shift C (Same structure as Shift A)

Day 1: Rows 6-209 (204 rows)
Day 2: Rows 210-413 (204 rows)
Day N: +204 rows each day
```

### **Column Mapping**
- **Column B**: Date and Shift information
- **Column C**: Unit (A or B)
- **Column D**: PO (Purchase Order)
- **Column E**: Cell name (L1-L8, R1-R8)
- **Columns F-K**: 6 columns of peel strength data

### **Calculation Logic**
1. **Row Average**: Sum of 6 columns ÷ 6
2. **Part Average**: Sum of 16 row averages ÷ 16 (L1-L8, R1-R8)
3. **Unit Average**: (Front + Back) ÷ 2
4. **Shift Average**: (Unit A + Unit B) ÷ 2
5. **Daily Average**: (Shift A + B + C) ÷ 3
6. **Final Average**: Average of all stringers

## 🚀 Quick Start

### **Prerequisites**
- Node.js 16+ 
- npm or yarn
- GitHub account
- OneDrive with Excel file

### **1. Clone Repository**
```bash
git clone https://github.com/your-username/ipqc-dashboard.git
cd ipqc-dashboard
```

### **2. Backend Setup**
```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### **3. Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

### **4. GitHub Actions Setup**
1. Add repository secret: `IPQC_PEEL_STRENGTH_URL` (OneDrive share URL)
2. Enable GitHub Actions in repository settings
3. Files will sync automatically every 2 hours

## 🔧 Configuration

### **Environment Variables**
```bash
# Required
PORT=3001
FRONTEND_URL=http://localhost:5173
IPQC_PEEL_STRENGTH_URL=your_onedrive_share_url

# Optional
CACHE_EXPIRY_MINUTES=5
UPPER_SPEC_LIMIT=3.0
LOWER_SPEC_LIMIT=2.0
TARGET_VALUE=2.5
```

### **GitHub Secrets**
- `IPQC_PEEL_STRENGTH_URL`: OneDrive share URL for Excel file

## 📡 API Endpoints

### **Phase 2 Data**
```
GET /api/phase2/data?stringer=7&shift=A&startDate=2025-05-01
GET /api/phase2/daily-averages
GET /api/phase2/stringers
GET /api/phase2/record/:id
POST /api/refresh
```

### **Response Format**
```json
{
  "data": [...],
  "statistics": {
    "avg": 2.485,
    "cpk": 1.234,
    "passRate": 96.5,
    "capability": "Good"
  },
  "totalRecords": 1440,
  "lastUpdated": "2025-01-01T12:00:00Z"
}
```

## 🔄 Data Flow

### **Automated Sync Process**
1. **GitHub Actions** runs every 2 hours (9 AM - 5 PM, weekdays)
2. **Python script** downloads Excel file from OneDrive
3. **File validation** ensures Excel format and size
4. **Git commit** triggers backend data refresh
5. **Backend cache** invalidates and reloads data
6. **Frontend** displays updated data automatically

### **Manual Refresh**
- **GitHub Actions**: Manual workflow dispatch
- **Backend API**: `POST /api/refresh`
- **Frontend**: Refresh button in dashboard

## 📊 Quality Control Features

### **Statistical Process Control**
- **Cp Index**: Process capability
- **Cpk Index**: Process capability with centering
- **Control Limits**: Upper/Lower control boundaries
- **Specification Limits**: Customer requirements

### **Performance Metrics**
- **Pass Rate**: Percentage within specifications
- **Trend Analysis**: Performance over time
- **Capability Assessment**: Excellent/Good/Fair/Poor rating

### **Alert System**
- **Out of Specification**: Values beyond limits
- **Process Drift**: Trending analysis
- **Capability Warnings**: Low Cpk values

## 🚨 Troubleshooting

### **Common Issues**

**1. Excel File Not Loading**
```bash
# Check file exists
ls -la data/IPQC_Peel_Strength.xlsx

# Validate file format
file data/IPQC_Peel_Strength.xlsx

# Check GitHub Actions logs
```

**2. Data Not Updating**
```bash
# Manual API refresh
curl -X POST http://localhost:3001/api/refresh

# Check cache status
curl http://localhost:3001/api/health
```

**3. GitHub Actions Failing**
- Verify OneDrive share URL is accessible
- Check `IPQC_PEEL_STRENGTH_URL` secret is set
- Ensure file permissions allow download

**4. "OFF" Values Handling**
- Units with "OFF" are automatically excluded
- Check logs for skipped units
- Verify calculation logic excludes affected data

## 🚀 Deployment

### **Backend (Render)**
1. Connect GitHub repository to Render
2. Set environment variables in Render dashboard
3. Deploy automatically on git push

### **Frontend (Netlify)**
1. Build the React application
2. Deploy to Netlify
3. Configure environment variables for API URL

### **Production Environment**
```bash
# Build frontend
npm run build

# Start production backend
NODE_ENV=production npm start
```

## 🔮 Future Enhancements

### **Planned Features**
- 📱 **Mobile App** - React Native companion app
- 🤖 **AI Predictions** - Machine learning for trend forecasting
- 📧 **Email Alerts** - Automated notifications for quality issues
- 📋 **Report Generation** - Automated PDF reports
- 🔄 **Real-time Sync** - WebSocket-based live updates
- 📊 **Advanced Analytics** - Six Sigma analysis tools

### **Phase 1 Integration**
- Support for Stringers 1-6
- Comparative analysis between phases
- Historical trend analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Material-UI team for the excellent component library
- Recharts team for powerful charting capabilities
- GitHub Actions for reliable automation
- OneDrive for seamless file sharing

---

**Built with ❤️ for Quality Excellence** 🎯