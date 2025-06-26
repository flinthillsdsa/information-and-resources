import fs from 'fs';

// Alternative approach using direct HTTP requests to Bluesky API
async function createSession(identifier, password) {
  const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: identifier,
      password: password,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Login failed: ${error.error} - ${error.message}`);
  }

  return await response.json();
}

async function getAuthorFeed(accessToken, actor, limit = 50) {
  const response = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to fetch feed: ${error.error} - ${error.message}`);
  }

  return await response.json();
}

// Helper function to format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Helper function to clean hashtags from text
function cleanText(text) {
  return text
    .replace(/#news\b/gi, '')
    .replace(/#announcement\b/gi, '')
    .replace(/#announce\b/gi, '')
    .trim();
}

// Helper function to get Bluesky post URL
function getBlueSkyUrl(uri, handle) {
  const postId = uri.split('/').pop();
  // Remove @ from handle if present
  const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
  return `https://bsky.app/profile/${cleanHandle}/post/${postId}`;
}

// Helper function to extract and format embedded content
function formatEmbeddedContent(embed) {
  let embeddedContent = '';
  
  if (!embed) return embeddedContent;
  
  // Handle images - simple markdown format
  if (embed.images && embed.images.length > 0) {
    embed.images.forEach((image, index) => {
      if (image.fullsize) {
        // Simple markdown image
        embeddedContent += `\n![Image from post](${image.fullsize})\n`;
      }
    });
  }
  
  // Handle external links (website cards) - make them actual clickable links
  if (embed.external) {
    embeddedContent += `\n[${embed.external.title || 'External Link'}](${embed.external.uri})\n`;
    
    if (embed.external.description) {
      embeddedContent += `\n${embed.external.description}\n`;
    }
    
    // Add thumbnail if available
    if (embed.external.thumb) {
      embeddedContent += `\n![Link preview](${embed.external.thumb})\n`;
    }
  }
  
  // Handle quote posts (reposts with comment)
  if (embed.record && embed.record.value && embed.record.value.text) {
    embeddedContent += `\n> ${embed.record.value.text}\n`;
  }
  
  return embeddedContent;
}

// Helper function to extract links from post text and make them clickable
function extractLinksFromText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = text.match(urlRegex);
  
  if (!links) return '';
  
  let linkContent = '';
  links.forEach(link => {
    // Make URLs clickable markdown links
    linkContent += `\n[${link}](${link})\n`;
  });
  
  return linkContent;
}

// Helper function to generate Jekyll front matter and content
function generateJekyllContent(posts, type, originalContent, handle) {
  // Extract the existing front matter
  const frontMatterMatch = originalContent.match(/^---\n([\s\S]*?)\n---/);
  const frontMatter = frontMatterMatch ? frontMatterMatch[1] : '';
  
  // Generate new content
  const content = posts.map(post => {
    const cleanedText = cleanText(post.text);
    const postUrl = getBlueSkyUrl(post.uri, handle);
    
    // Get embedded content (images, links, etc.)
    const embeddedContent = formatEmbeddedContent(post.embed);
    
    // Extract any additional links from the text that aren't in embeds
    const textLinks = post.embed ? '' : extractLinksFromText(post.text);
    
    return `### ${formatDate(post.createdAt)}

${cleanedText}
${embeddedContent}${textLinks}

---`;
  }).join('\n\n');

  // Combine front matter with new content
  return `---
${frontMatter}
---

*Last updated: ${new Date().toLocaleString('en-US', { 
  timeZone: 'America/Chicago',
  year: 'numeric',
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}*

${content}`;
}

async function fetchAndUpdateContent() {
  try {
    // Debug environment variables (without exposing sensitive data)
    console.log('Checking environment variables...');
    console.log('BLUESKY_HANDLE:', process.env.BLUESKY_HANDLE ? 'Set' : 'Missing');
    console.log('BLUESKY_APP_PASSWORD:', process.env.BLUESKY_APP_PASSWORD ? 'Set' : 'Missing');
    
    // Clean up the handle format
    let handle = process.env.BLUESKY_HANDLE;
    if (handle.startsWith('@')) {
      handle = handle.substring(1);
    }
    console.log('Using handle:', handle);

    // Login to Bluesky using direct API
    console.log('Creating session with Bluesky...');
    const session = await createSession(handle, process.env.BLUESKY_APP_PASSWORD);
    console.log('✅ Successfully logged in to Bluesky');

    // Get recent posts from your feed
    console.log('Fetching recent posts...');
    const feedData = await getAuthorFeed(session.accessJwt, handle, 50);

    const newsPosts = [];
    const announcementPosts = [];

    // Filter posts by hashtags
    feedData.feed.forEach(item => {
      const text = item.post.record.text;
      const postData = {
        text: text,
        createdAt: item.post.record.createdAt,
        uri: item.post.uri,
        embed: item.post.record.embed
      };

      // Debug: Log embed data for posts with hashtags
      if (text.toLowerCase().includes('#news') || text.toLowerCase().includes('#announcement') || text.toLowerCase().includes('#announce')) {
        console.log('Found relevant post:', {
          text: text.substring(0, 80) + '...',
          hasEmbed: !!postData.embed,
          embedDetails: postData.embed ? {
            type: postData.embed.$type,
            hasImages: !!(postData.embed.images && postData.embed.images.length > 0),
            imageCount: postData.embed.images ? postData.embed.images.length : 0,
            hasExternal: !!postData.embed.external,
            externalUrl: postData.embed.external ? postData.embed.external.uri : null,
            hasRecord: !!postData.embed.record
          } : 'No embed data'
        });
      }

      if (text.toLowerCase().includes('#news')) {
        newsPosts.push(postData);
      }
      
      if (text.toLowerCase().includes('#announcement') || text.toLowerCase().includes('#announce')) {
        announcementPosts.push(postData);
      }
    });

    // Sort by date (newest first) and take only the last 3
    const sortedNews = newsPosts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);
    
    const sortedAnnouncements = announcementPosts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 3);

    console.log(`Found ${sortedNews.length} news posts and ${sortedAnnouncements.length} announcement posts`);

    // Read existing files to preserve front matter
    const newsFilePath = '_portfolio/3-news.md';
    const announcementsFilePath = '_portfolio/2-announcements.md';

    let existingNewsContent = '';
    let existingAnnouncementsContent = '';

    try {
      existingNewsContent = fs.readFileSync(newsFilePath, 'utf8');
    } catch (error) {
      console.log('News file not found, will create new one');
      existingNewsContent = `---
layout: post
title: News
feature-img: "assets/img/portfolio/tractor.png"
img: "assets/img/portfolio/tractor.png"
date: ${new Date().toISOString().split('T')[0]}
---`;
    }

    try {
      existingAnnouncementsContent = fs.readFileSync(announcementsFilePath, 'utf8');
    } catch (error) {
      console.log('Announcements file not found, will create new one');
      existingAnnouncementsContent = `---
layout: post
title: Announcements
feature-img: "assets/img/portfolio/tractor.png"
img: "assets/img/portfolio/tractor.png"
date: ${new Date().toISOString().split('T')[0]}
---`;
    }

    // Update news file
    if (sortedNews.length > 0) {
      const newNewsContent = generateJekyllContent(sortedNews, 'news', existingNewsContent, handle);
      fs.writeFileSync(newsFilePath, newNewsContent);
      console.log('✅ Updated news file');
    } else {
      console.log('No news posts found, keeping existing content');
    }

    // Update announcements file
    if (sortedAnnouncements.length > 0) {
      const newAnnouncementsContent = generateJekyllContent(sortedAnnouncements, 'announcements', existingAnnouncementsContent, handle);
      fs.writeFileSync(announcementsFilePath, newAnnouncementsContent);
      console.log('✅ Updated announcements file');
    } else {
      console.log('No announcement posts found, keeping existing content');
    }

    console.log('🎉 Content update completed successfully!');

  } catch (error) {
    console.error('❌ Error updating content:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Validate environment variables
if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
  console.error('❌ Missing required environment variables: BLUESKY_HANDLE and BLUESKY_APP_PASSWORD');
  process.exit(1);
}

// Run the update
fetchAndUpdateContent();
