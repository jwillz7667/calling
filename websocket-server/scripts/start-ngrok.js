#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = process.env.PORT || 8081;
const envPath = path.join(__dirname, '..', '.env');

// Start ngrok
console.log(`🚀 Starting ngrok on port ${PORT}...`);
const ngrok = spawn('ngrok', ['http', PORT.toString()], {
  stdio: ['inherit', 'pipe', 'inherit']
});

let output = '';
let tunnelFound = false;

ngrok.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Look for the tunnel URL in the output
  if (!tunnelFound) {
    // Check for the public URL in ngrok output
    const urlMatch = text.match(/https:\/\/[a-z0-9-]+\.ngrok[-a-z0-9]*\.(io|app)/i);
    if (urlMatch) {
      tunnelFound = true;
      const publicUrl = urlMatch[0];
      console.log(`\n✅ Ngrok tunnel established: ${publicUrl}`);
      
      // Update .env file
      updateEnvFile(publicUrl);
      
      // Try to get the ngrok API info
      setTimeout(() => {
        fetchNgrokInfo();
      }, 2000);
    }
  }
});

ngrok.on('close', (code) => {
  console.log(`\nNgrok process exited with code ${code}`);
  process.exit(code);
});

function updateEnvFile(publicUrl) {
  try {
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add PUBLIC_URL
    const publicUrlRegex = /^PUBLIC_URL=.*$/m;
    if (publicUrlRegex.test(envContent)) {
      envContent = envContent.replace(publicUrlRegex, `PUBLIC_URL=${publicUrl}`);
    } else {
      envContent += `\nPUBLIC_URL=${publicUrl}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log(`✅ Updated PUBLIC_URL in .env file to: ${publicUrl}`);
    console.log(`\n📱 Configure this URL in your Twilio phone number webhooks:`);
    console.log(`   Voice URL: ${publicUrl}/twiml`);
    console.log(`   Status Callback: ${publicUrl}/call-status`);
    console.log(`\n🌐 Frontend WebSocket URLs:`);
    console.log(`   Call: wss://${publicUrl.replace('https://', '')}/call`);
    console.log(`   Logs: wss://${publicUrl.replace('https://', '')}/logs`);
  } catch (error) {
    console.error('❌ Failed to update .env file:', error.message);
  }
}

function fetchNgrokInfo() {
  // Try to get tunnel info from ngrok API
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const tunnels = JSON.parse(data);
        if (tunnels.tunnels && tunnels.tunnels.length > 0) {
          const httpsTunnel = tunnels.tunnels.find(t => t.proto === 'https');
          if (httpsTunnel) {
            console.log(`\n📊 Ngrok Dashboard: http://127.0.0.1:4040`);
            console.log(`📈 Tunnel metrics: ${httpsTunnel.metrics.conns.count} connections`);
          }
        }
      } catch (e) {
        // Ngrok API might not be available
      }
    });
  }).on('error', () => {
    // Ngrok API not available, that's okay
  });
}

// Handle termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down ngrok...');
  ngrok.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ngrok.kill();
  process.exit(0);
});