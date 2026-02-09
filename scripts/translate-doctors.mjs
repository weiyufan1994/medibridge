import { drizzle } from 'drizzle-orm/mysql2';
import { doctors } from '../drizzle/schema.ts';
import { eq, isNotNull, or } from 'drizzle-orm';
import 'dotenv/config';

const db = drizzle(process.env.DATABASE_URL);

async function translateText(text) {
  if (!text || text.trim() === '') return text;
  
  try {
    const response = await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/llm/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a professional medical translator. Translate Chinese medical text to English. Keep medical terms accurate and professional. Only return the translated text, no explanations.'
          },
          {
            role: 'user',
            content: `Translate this Chinese medical text to English:\n\n${text}`
          }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`Translation API error: ${response.status}`);
      return text; // Return original if translation fails
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Translation error:', error.message);
    return text; // Return original if error
  }
}

async function translateDoctors() {
  console.log('Starting doctor information translation...\n');

  // Get all doctors with Chinese specialty or expertise
  const allDoctors = await db.select().from(doctors)
    .where(
      or(
        isNotNull(doctors.specialty),
        isNotNull(doctors.expertise)
      )
    );

  console.log(`Found ${allDoctors.length} doctors to translate\n`);

  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doctor of allDoctors) {
    try {
      // Check if already translated (contains mostly English characters)
      const specialtyIsEnglish = doctor.specialty && /^[a-zA-Z\s,.-]+$/.test(doctor.specialty.substring(0, 50));
      const expertiseIsEnglish = doctor.expertise && /^[a-zA-Z\s,.-]+$/.test(doctor.expertise.substring(0, 50));

      if (specialtyIsEnglish && expertiseIsEnglish) {
        skipped++;
        if (skipped % 50 === 0) {
          console.log(`Skipped ${skipped} already-translated doctors...`);
        }
        continue;
      }

      const updates = {};

      // Translate specialty if needed
      if (doctor.specialty && !specialtyIsEnglish) {
        const translatedSpecialty = await translateText(doctor.specialty);
        updates.specialtyEn = translatedSpecialty;
        console.log(`[${translated + 1}] ${doctor.name} - Specialty translated`);
      }

      // Translate expertise if needed
      if (doctor.expertise && !expertiseIsEnglish) {
        const translatedExpertise = await translateText(doctor.expertise);
        updates.expertiseEn = translatedExpertise;
        console.log(`[${translated + 1}] ${doctor.name} - Expertise translated`);
      }

      // Update database
      if (Object.keys(updates).length > 0) {
        await db.update(doctors)
          .set(updates)
          .where(eq(doctors.id, doctor.id));
        
        translated++;

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

        if (translated % 10 === 0) {
          console.log(`\n✅ Progress: ${translated} translated, ${skipped} skipped, ${failed} failed\n`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to translate doctor ${doctor.name}:`, error.message);
      failed++;
    }
  }

  console.log('\n=== Translation Complete ===');
  console.log(`✅ Translated: ${translated}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
}

translateDoctors().catch(console.error);
