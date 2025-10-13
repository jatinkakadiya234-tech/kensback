// Cleanup and test script for chunked upload issues
import fs from 'fs';
import path from 'path';

console.log('🧹 Cleaning up and testing chunked upload system...\n');

// Function to get directory size
function getDirectorySize(dirPath) {
  let totalSize = 0;
  
  function calculateSize(currentPath) {
    try {
      const stats = fs.statSync(currentPath);
      if (stats.isDirectory()) {
        const files = fs.readdirSync(currentPath);
        files.forEach(file => {
          calculateSize(path.join(currentPath, file));
        });
      } else {
        totalSize += stats.size;
      }
    } catch (error) {
      console.error(`Error calculating size for ${currentPath}:`, error.message);
    }
  }
  
  calculateSize(dirPath);
  return totalSize;
}

// Function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Clean up upload directories
const dirs = ['./uploads/chunks', './uploads/others'];
dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const sizeBefore = getDirectorySize(dir);
    console.log(`📁 ${dir}: ${formatBytes(sizeBefore)}`);
    
    try {
      const files = fs.readdirSync(dir);
      console.log(`   Files: ${files.length}`);
      
      // Clean up all files
      files.forEach(file => {
        const filePath = path.join(dir, file);
        try {
          fs.unlinkSync(filePath);
          console.log(`   ✅ Deleted: ${file}`);
        } catch (error) {
          console.log(`   ❌ Failed to delete: ${file} - ${error.message}`);
        }
      });
      
      const sizeAfter = getDirectorySize(dir);
      console.log(`   After cleanup: ${formatBytes(sizeAfter)}\n`);
    } catch (error) {
      console.error(`Error cleaning ${dir}:`, error.message);
    }
  } else {
    console.log(`📁 ${dir}: Directory does not exist\n`);
  }
});

// Test file creation
console.log('🧪 Testing file creation...');
const testDir = './uploads/chunks';
const testFile = path.join(testDir, 'test-file.tmp');

try {
  // Ensure directory exists
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`✅ Created directory: ${testDir}`);
  }

  // Create a test file
  const testData = Buffer.alloc(1024 * 1024); // 1MB test data
  fs.writeFileSync(testFile, testData);
  console.log(`✅ Created test file: ${testFile}`);

  // Verify file
  const stats = fs.statSync(testFile);
  console.log(`✅ File size: ${formatBytes(stats.size)}`);

  // Clean up test file
  fs.unlinkSync(testFile);
  console.log(`✅ Cleaned up test file`);

  console.log('\n🎉 System is ready for chunked uploads!');
  console.log('📝 Recommendations:');
  console.log('1. Monitor disk space regularly');
  console.log('2. Clean up old files periodically');
  console.log('3. Use smaller chunk sizes for very large files');
  console.log('4. Check file permissions on upload directories');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Error details:', {
    code: error.code,
    errno: error.errno,
    syscall: error.syscall,
    path: error.path
  });
}
