// Test script to verify upload directories
import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Upload Directory Creation...\n');

const dirs = [
  './uploads',
  './uploads/chunks',
  './uploads/videos',
  './uploads/images',
  './uploads/others'
];

console.log('📁 Checking/Creating directories:');
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created: ${dir}`);
  } else {
    console.log(`✅ Exists: ${dir}`);
  }
});

console.log('\n📊 Directory structure:');
function printTree(dir, prefix = '') {
  const items = fs.readdirSync(dir);
  items.forEach((item, index) => {
    const itemPath = path.join(dir, item);
    const isLast = index === items.length - 1;
    const currentPrefix = isLast ? '└── ' : '├── ';
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    
    console.log(`${prefix}${currentPrefix}${item}`);
    
    if (fs.statSync(itemPath).isDirectory()) {
      printTree(itemPath, nextPrefix);
    }
  });
}

if (fs.existsSync('./uploads')) {
  console.log('uploads/');
  printTree('./uploads');
}

console.log('\n✅ Upload directory test completed!');
console.log('\n🚀 You can now test the chunked upload functionality.');
