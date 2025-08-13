#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

const PORT = process.env.PORT || 8081;

// Always use paths relative to the script location
// This works regardless of where the script is called from
const scriptDir = __dirname;
const projectRoot = path.join(scriptDir, '..', '..');
const envPath = path.join(scriptDir, '..', '.env');
const webappEnvPath = path.join(projectRoot, 'webapp', '.env');

console.log(`📁 Script location: ${scriptDir}`);
console.log(`📁 Project root: ${projectRoot}`);
console.log(`📄 Backend .env path: ${envPath}`);
console.log(`📄 Webapp .env path: ${webappEnvPath}`);

// Load environment variables
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(webappEnvPath)) {
  dotenv.config({ path: webappEnvPath });
}

// Start ngrok
console.log(`🚀 Starting ngrok on port ${PORT}...`);
console.log(`   Command: ngrok http ${PORT}`);

const ngrok = spawn('ngrok', ['http', PORT.toString()], {
  stdio: ['inherit', 'pipe', 'pipe']
});

let output = '';
let tunnelFound = false;

// Handle stderr
ngrok.stderr.on('data', (data) => {
  const text = data.toString();
  console.error('Ngrok error:', text);
});

ngrok.on('error', (error) => {
  console.error('Failed to start ngrok:', error.message);
  if (error.code === 'ENOENT') {
    console.error('\n❌ ngrok not found. Please install it:');
    console.error('   Mac: brew install ngrok');
    console.error('   Or download from: https://ngrok.com/download');
  }
  process.exit(1);
});

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
      
      // Update Twilio webhook URLs if credentials are available
      updateTwilioWebhooks(publicUrl);
      
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

async function updateTwilioWebhooks(publicUrl) {
  try {
    // Load Twilio credentials
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumberSid = process.env.TWILIO_PHONE_NUMBER_SID;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    if (!accountSid || !authToken) {
      console.log('\n⚠️  Twilio credentials not found in environment variables');
      console.log('   Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to webapp/.env to enable auto-update');
      return;
    }
    
    const twilio = require('twilio')(accountSid, authToken);
    
    // If we have a specific phone number SID, use it
    if (phoneNumberSid) {
      await updatePhoneNumber(twilio, phoneNumberSid, publicUrl);
    } else if (phoneNumber) {
      // Try to find the phone number SID
      const numbers = await twilio.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber
      });
      
      if (numbers.length > 0) {
        await updatePhoneNumber(twilio, numbers[0].sid, publicUrl);
      } else {
        console.log(`\n⚠️  Phone number ${phoneNumber} not found in Twilio account`);
      }
    } else {
      // List all phone numbers and let user choose
      const numbers = await twilio.incomingPhoneNumbers.list();
      
      if (numbers.length === 0) {
        console.log('\n⚠️  No phone numbers found in Twilio account');
        return;
      }
      
      if (numbers.length === 1) {
        // Only one number, use it automatically
        await updatePhoneNumber(twilio, numbers[0].sid, publicUrl);
      } else {
        // Multiple numbers, show them all
        console.log('\n📱 Found multiple Twilio phone numbers:');
        numbers.forEach((num, idx) => {
          console.log(`   ${idx + 1}. ${num.phoneNumber} (${num.friendlyName})`);
        });
        console.log('\n   Add TWILIO_PHONE_NUMBER or TWILIO_PHONE_NUMBER_SID to webapp/.env');
        console.log('   to automatically update a specific number');
        
        // Update the first one as default
        console.log(`\n   Updating the first number: ${numbers[0].phoneNumber}`);
        await updatePhoneNumber(twilio, numbers[0].sid, publicUrl);
      }
    }
  } catch (error) {
    console.error('\n❌ Failed to update Twilio webhooks:', error.message);
    if (error.message.includes('authenticate')) {
      console.log('   Check that your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are correct');
    }
  }
}

async function updatePhoneNumber(twilio, phoneNumberSid, publicUrl) {
  try {
    const voiceUrl = `${publicUrl}/twiml`;
    const statusCallback = `${publicUrl}/call-status`;
    const voiceMethod = 'POST';
    
    const result = await twilio.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: voiceUrl,
      voiceMethod: voiceMethod,
      statusCallback: statusCallback,
      statusCallbackMethod: 'POST'
    });
    
    console.log(`\n✅ Updated Twilio phone number: ${result.phoneNumber}`);
    console.log(`   Voice URL: ${voiceUrl}`);
    console.log(`   Status Callback: ${statusCallback}`);
    console.log(`   Phone Number SID: ${phoneNumberSid}`);
    
    // Save the phone number SID for future use
    updateEnvVariable('TWILIO_PHONE_NUMBER_SID', phoneNumberSid);
    updateEnvVariable('TWILIO_PHONE_NUMBER', result.phoneNumber);
    
  } catch (error) {
    console.error(`\n❌ Failed to update phone number ${phoneNumberSid}:`, error.message);
  }
}

function updateEnvVariable(key, value) {
  try {
    // Update webapp .env
    let envContent = '';
    if (fs.existsSync(webappEnvPath)) {
      envContent = fs.readFileSync(webappEnvPath, 'utf8');
    }
    
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
    
    fs.writeFileSync(webappEnvPath, envContent);
  } catch (error) {
    // Silent fail for env update
  }
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