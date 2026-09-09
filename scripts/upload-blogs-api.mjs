import { blogs } from "./seed-blogs.mjs";
import { articles } from "./publish-10-articles.mjs";

const API_URL = "https://bitsolmarketing.com/api/blog";
const API_KEY = process.env.BLOG_API_KEY;

const allPosts = [...blogs, ...articles];

async function upload() {
  console.log(`Uploading ${allPosts.length} posts to ${API_URL}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const post of allPosts) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
        },
        body: JSON.stringify(post),
      });

      if (res.status === 201) {
        console.log(`✅ Created:  ${post.title}`);
        created++;
      } else if (res.status === 409) {
        console.log(`⏭  Skipped:  ${post.title} (already exists)`);
        skipped++;
      } else {
        const err = await res.json();
        console.error(`❌ Failed:   ${post.title} — ${err.error}`);
        failed++;
      }
    } catch (err) {
      console.error(`❌ Failed:   ${post.title} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone — Created: ${created}  Skipped: ${skipped}  Failed: ${failed}`);
}

upload();
