import { drizzle } from 'drizzle-orm/mysql2';
import { hospitals } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const db = drizzle(process.env.DATABASE_URL);

// Official hospital websites (verified)
const hospitalWebsites = {
  '复旦大学附属华山医院': 'https://www.huashan.org.cn/',
  '复旦大学附属中山医院': 'https://www.zs-hospital.sh.cn/',
  '上海交通大学医学院附属瑞金医院': 'https://www.rjh.com.cn/',
  '复旦大学附属肿瘤医院': 'https://www.shca.org.cn/',
  '上海市第六人民医院': 'https://www.6thhosp.com/',
  '上海交通大学医学院附属第九人民医院': 'https://www.9hospital.com.cn/',
};

async function addHospitalLinks() {
  console.log('Adding hospital website links...\n');

  const allHospitals = await db.select().from(hospitals);

  for (const hospital of allHospitals) {
    const website = hospitalWebsites[hospital.name];
    
    if (website) {
      await db.update(hospitals)
        .set({ website })
        .where(eq(hospitals.id, hospital.id));
      
      console.log(`✅ ${hospital.name}: ${website}`);
    } else {
      console.log(`⚠️  ${hospital.name}: No website found`);
    }
  }

  console.log('\n✅ Hospital links added successfully');
}

addHospitalLinks().catch(console.error);
