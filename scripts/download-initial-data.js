// scripts/download-initial-data.js
// Script to download Excel file from GitHub on deployment

const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_REPO = process.env.GITHUB_REPO || 'your-username/ipqc-dashboard-backend';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const EXCEL_FILE_NAME = 'IPQC_Peel_Strength.xlsx';

async function downloadFromGitHub() {
    console.log('🔍 Attempting to download Excel file from GitHub...');
    
    if (!GITHUB_TOKEN) {
        console.log('⚠️ No GitHub token provided, skipping initial download');
        return;
    }

    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/${EXCEL_FILE_NAME}`;
    
    const options = {
        headers: {
            'User-Agent': 'IPQC-Dashboard/1.0',
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.raw'
        }
    };

    return new Promise((resolve, reject) => {
        const request = https.get(url, options, (response) => {
            if (response.statusCode === 200) {
                const filePath = path.join(__dirname, '..', 'data', EXCEL_FILE_NAME);
                const fileStream = fs.createWriteStream(filePath);
                
                response.pipe(fileStream);
                
                fileStream.on('finish', () => {
                    fileStream.close();
                    console.log(`✅ Successfully downloaded ${EXCEL_FILE_NAME}`);
                    resolve();
                });
                
                fileStream.on('error', (error) => {
                    console.error('❌ Error writing file:', error);
                    reject(error);
                });
            } else if (response.statusCode === 404) {
                console.log('📝 Excel file not found in repository yet, will be available after first GitHub Actions run');
                resolve();
            } else {
                console.error(`❌ GitHub API error: ${response.statusCode}`);
                reject(new Error(`GitHub API returned ${response.statusCode}`));
            }
        });

        request.on('error', (error) => {
            console.error('❌ Network error:', error);
            reject(error);
        });

        request.setTimeout(30000, () => {
            console.error('❌ Request timeout');
            request.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Run if called directly
if (require.main === module) {
    downloadFromGitHub()
        .then(() => {
            console.log('🎉 Initial data download completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Initial data download failed:', error.message);
            process.exit(0); // Don't fail the build
        });
}

module.exports = { downloadFromGitHub };