// Simple startup script to check system requirements and start the server
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Starting ResumeRAG System...\n');

// Check if MongoDB is available
async function checkMongoDB() {
    return new Promise((resolve) => {
        const mongod = spawn('mongod', ['--version'], { shell: true });
        mongod.on('close', (code) => {
            if (code === 0) {
                console.log('✅ MongoDB is available');
                resolve(true);
            } else {
                console.log('❌ MongoDB not found. Please install MongoDB:');
                console.log('   - Windows: https://www.mongodb.com/try/download/community');
                console.log('   - macOS: brew install mongodb-community');
                console.log('   - Ubuntu: sudo apt install mongodb');
                resolve(false);
            }
        });
    });
}

// Check if Node.js version is compatible
function checkNodeVersion() {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    
    if (majorVersion >= 16) {
        console.log(`✅ Node.js ${version} is compatible`);
        return true;
    } else {
        console.log(`❌ Node.js ${version} is not compatible. Please use Node.js 16 or higher.`);
        return false;
    }
}

// Check if backend directory exists
function checkBackendDirectory() {
    const backendPath = path.join(process.cwd(), 'backend');
    if (fs.existsSync(backendPath)) {
        console.log('✅ Backend directory found');
        return true;
    } else {
        console.log('❌ Backend directory not found');
        return false;
    }
}

// Check if package.json exists
function checkPackageJson() {
    const packagePath = path.join(process.cwd(), 'backend', 'package.json');
    if (fs.existsSync(packagePath)) {
        console.log('✅ package.json found');
        return true;
    } else {
        console.log('❌ package.json not found');
        return false;
    }
}

// Main startup function
async function start() {
    console.log('🔍 Checking system requirements...\n');
    
    const checks = [
        checkNodeVersion(),
        checkBackendDirectory(),
        checkPackageJson(),
        await checkMongoDB()
    ];
    
    const allPassed = checks.every(check => check);
    
    if (allPassed) {
        console.log('\n✅ All checks passed! Starting server...\n');
        
        // Start the backend server
        const server = spawn('npm', ['start'], { 
            cwd: path.join(process.cwd(), 'backend'),
            stdio: 'inherit',
            shell: true 
        });
        
        server.on('close', (code) => {
            console.log(`\n🛑 Server exited with code ${code}`);
        });
        
        // Handle Ctrl+C
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down server...');
            server.kill('SIGINT');
            process.exit(0);
        });
        
    } else {
        console.log('\n❌ Some checks failed. Please resolve the issues above before starting the server.');
        process.exit(1);
    }
}

start().catch(console.error);
