#!/usr/bin/env node

const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;
const envPath = path.join(__dirname, '..', '.env');

console.log(`🚀 Starting ngrok on port ${PORT}...`);
console.log(`   This will open ngrok in a new terminal window/tab`);

// Start ngrok using exec (simpler approach)
const command = `ngrok http ${PORT}`;
console.log(`   Running: ${command}`);

const ngrokProcess = exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error starting ngrok: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Ngrok stderr: ${stderr}`);
  }
});

// Wait a bit for ngrok to start, then try to get the URL from the API
setTimeout(() => {
  checkNgrokApi();
}, 3000);

function checkNgrokApi() {
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const tunnels = JSON.parse(data);
        if (tunnels.tunnels && tunnels.tunnels.length > 0) {
          const httpsTunnel = tunnels.tunnels.find(t => t.proto === 'https') || tunnels.tunnels[0];
          if (httpsTunnel) {
            const publicUrl = httpsTunnel.public_url;
            console.log(`\n✅ Ngrok tunnel established: ${publicUrl}`);
            console.log(`📊 Ngrok Dashboard: http://127.0.0.1:4040`);
            
            // Update .env file
            updateEnvFile(publicUrl);
            
            console.log(`\n📱 Configure these URLs in Twilio:`);
            console.log(`   Voice URL: ${publicUrl}/twiml`);
            console.log(`   Status Callback: ${publicUrl}/call-status`);
            
            console.log(`\n🌐 Frontend WebSocket URLs:`);
            console.log(`   Call: wss://${publicUrl.replace('https://', '')}/call`);
            console.log(`   Logs: wss://${publicUrl.replace('https://', '')}/logs`);
          }
        } else {
          console.log('⏳ Waiting for ngrok to start...');
          setTimeout(checkNgrokApi, 2000);
        }
      } catch (e) {
        console.log('⏳ Waiting for ngrok API...');
        setTimeout(checkNgrokApi, 2000);
      }
    });
  }).on('error', () => {
    console.log('⏳ Ngrok API not ready yet...');
    setTimeout(checkNgrokApi, 2000);
  });
}

function updateEnvFile(publicUrl) {
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    const publicUrlRegex = /^PUBLIC_URL=.*$/m;
    if (publicUrlRegex.test(envContent)) {
      envContent = envContent.replace(publicUrlRegex, `PUBLIC_URL=${publicUrl}`);
    } else {
      envContent += `\nPUBLIC_URL=${publicUrl}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`\n✅ Updated PUBLIC_URL in .env file to: ${publicUrl}`);
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
  }
}

// Keep the process running
process.stdin.resume();

// Handle termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down ngrok...');
  if (ngrokProcess) {
    ngrokProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (ngrokProcess) {
    ngrokProcess.kill();
  }
  process.exit(0);
});