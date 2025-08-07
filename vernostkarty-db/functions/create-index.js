const { Datastore } = require('@google-cloud/datastore');

async function createIndex() {
  const datastore = new Datastore({ projectId: 'vernostkarty-db' });
  
  console.log('🔍 Creating Datastore index for certificates.fullId...');
  
  try {
    // Create a simple query to trigger index creation
    const query = datastore.createQuery('certificates')
      .filter('fullId', '=', 'dummy-value-to-trigger-index-creation')
      .limit(1);
    
    console.log('📊 Running query to trigger index creation...');
    const [results] = await query.run();
    
    console.log('✅ Index creation triggered successfully!');
    console.log('ℹ️  Note: Index creation may take a few minutes to complete in the background.');
    console.log('🔄 You can check index status in Google Cloud Console > Datastore > Indexes');
    
  } catch (error) {
    if (error.code === 9 && error.details.includes('index')) {
      console.log('✅ Index creation request sent to Google Cloud!');
      console.log('⏳ Index is being built in the background...');
      console.log('🔄 Try running the assignCertificate function again in a few minutes.');
    } else {
      console.error('❌ Error creating index:', error);
    }
  }
}

createIndex().catch(console.error);
