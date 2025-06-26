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
  const date = new Date(dateString);
  console.log(`Original date string: ${dateString}, Parsed date: ${date.toISOString()}, Formatted: ${date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`);
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago' // Use your local timezone
  });
}

// Helper function to clean hashtags and replace truncated URLs with links
function cleanText(text, facets) {
  let cleanedText = text
    .replace(/#news\b/gi, '')
    .replace(/#announcement\b/gi, '')
    .replace(/#announce\b/gi, '')
    .trim();
  
  // Handle facet links by replacing truncated text with clickable links
  if (facets && facets.length > 0) {
    // Work with the original text for accurate byte positions
    let workingText = text;
    
    // Sort facets by start position in reverse order so we don't mess up indices
    const linkFacets = facets
      .filter(facet => facet.features.some(f => f.$type === 'app.bsky.richtext.facet#link'))
      .sort((a, b) => b.index.byteStart - a.index.byteStart);
    
    linkFacets.forEach(facet => {
      const linkFeature = facet.features.find(f => f.$type === 'app.bsky.richtext.facet#link');
      if (linkFeature) {
        // Get the truncated text from the original position
        const truncatedText = workingText.substring(facet.index.byteStart, facet.index.byteEnd);
        
        // Replace the truncated text with a clickable link
        const before = workingText.substring(0, facet.index.byteStart);
        const after = workingText.substring(facet.index.byteEnd);
        workingText = before + `[${truncatedText}](${linkFeature.uri})` + after;
      }
    });
    
    // Now clean the hashtags from the working text
    cleanedText = workingText
      .replace(/#news\b/gi, '')
      .replace(/#announcement\b/gi, '')
      .replace(/#announce\b/gi, '')
      .trim();
  }
  
  // Clean up any extra spaces that might be left
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  
  return cleanedText;
}

// Helper function to get Bluesky post URL
function getBlueSkyUrl(uri, handle) {
  const postId = uri.split('/').pop();
  // Remove @ from handle if present
  const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
  return `https://bsky.app/profile/${cleanHandle}/post/${postId}`;
}

// Helper function to extract and format embedded content
function formatEmbeddedContent(embed, facets, postText, userDid) {
  let images = '';
  let links = '';
  
  // Handle images from embed - collect them first
  if (embed && embed.images && embed.images.length > 0) {
    embed.images.forEach((image, index) => {
      let imageUrl = null;
      
      // Handle different image URL formats
      if (image.fullsize) {
        // Direct URL format (older or processed)
        imageUrl = image.fullsize;
      } else if (image.image && image.image.ref && image.image.ref.$link) {
        // Blob format - construct the CDN URL with user DID
        const blobRef = image.image.ref.$link;
        imageUrl = `https://cdn.bsky.app/img/feed_fullsize/plain/${userDid}/${blobRef}@jpeg`;
      }
      
      if (imageUrl) {
        console.log(`Adding image: ${imageUrl}`);
        images += `\n<div align="center">\n<img src="${imageUrl}" alt="${image.alt || 'Image from Bluesky post'}" style="max-width: 300px; width: 100%; height: auto; margin: 10px 0; border-radius: 8px; display: block;">\n</div>\n`;
      } else {
        console.log('Image found but no URL could be constructed:', JSON.stringify(image, null, 2));
      }
    });
  }
  
  // Handle external links from embed (link-only posts)
  if (embed && embed.external) {
    links += `\n[${embed.external.title || embed.external.uri}](${embed.external.uri})\n`;
    
    if (embed.external.description) {
      links += `\n${embed.external.description}\n`;
    }
  }
  
  // Handle recordWithMedia embeds (images + external link combined)
  if (embed && embed.$type === 'app.bsky.embed.recordWithMedia') {
    // Handle images from the media part
    if (embed.media && embed.media.images) {
      embed.media.images.forEach((image, index) => {
        let imageUrl = null;
        
        if (image.fullsize) {
          imageUrl = image.fullsize;
        } else if (image.image && image.image.ref && image.image.ref.$link) {
          const blobRef = image.image.ref.$link;
          imageUrl = `https://cdn.bsky.app/img/feed_fullsize/plain/${userDid}/${blobRef}@jpeg`;
        }
        
        if (imageUrl) {
          images += `\n<div align="center">\n<img src="${imageUrl}" alt="${image.alt || 'Image from Bluesky post'}" style="max-width: 300px; width: 100%; height: auto; margin: 10px 0; border-radius: 8px; display: block;">\n</div>\n`;
        }
      });
    }
    
    // Handle external link from the media part
    if (embed.media && embed.media.external) {
      links += `\n[${embed.media.external.title || embed.media.external.uri}](${embed.media.external.uri})\n`;
      
      if (embed.media.external.description) {
        links += `\n${embed.media.external.description}\n`;
      }
    }
  }
  
  // Handle links from facets (for posts with images + text links)
  // Note: These are now handled inline in cleanText function
  // This section is kept for external embeds only
  
  // Handle quote posts (reposts with comment)
  if (embed && embed.record && embed.record.value && embed.record.value.text) {
    links += `\n> ${embed.record.value.text}\n`;
  }
  
  // Return images first, then links
  return { images, links };
}

// Helper function to extract links from post text and make them clickable
function extractLinksFromText(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const links = text.match(urlRegex);
  
  if (!links) return '';
  
  let linkContent = '';
  links.forEach(link => {
    // Clean up the link (remove trailing punctuation that might get caught)
    const cleanLink = link.replace(/[.,;!?)]+$/, '');
    linkContent += `\n[${cleanLink}](${cleanLink})\n`;
  });
  
  return linkContent;
}

// Helper function to generate Jekyll front matter and content
function generateJekyllContent(posts, type, originalContent, handle, userDid) {
  // Extract the existing front matter
  const frontMatterMatch = originalContent.match(/^---\n([\s\S]*?)\n---/);
  const frontMatter = frontMatterMatch ? frontMatterMatch[1] : '';
  
  // Generate new content
  const content = posts.map(post => {
    const cleanedText = cleanText(post.text, post.facets);
    
    // Get embedded content (images, links, etc.)
    const embedded = formatEmbeddedContent(post.embed, post.facets, post.text, userDid);
    
    // Extract any additional links from the text that aren't in embeds
    const textLinks = post.embed ? '' : extractLinksFromText(post.text);
    
    return `### ${formatDate(post.createdAt)}
${embedded.images}
${cleanedText}${embedded.links}${textLinks}

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
    
    // Store the user's DID for image URL construction
    const userDid = session.did;
    console.log('User DID:', userDid);

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
        embed: item.post.record.embed,
        facets: item.post.record.facets // Add facets for links in text
      };

      // Debug: Log embed data for posts with hashtags
      if (text.toLowerCase().includes('#news') || text.toLowerCase().includes('#announcement') || text.toLowerCase().includes('#announce')) {
        console.log('Found relevant post:', {
          text: text.substring(0, 80) + '...',
          hasEmbed: !!postData.embed,
          hasFacets: !!(postData.facets && postData.facets.length > 0),
          embedDetails: postData.embed ? {
            type: postData.embed.$type,
            hasImages: !!(postData.embed.images && postData.embed.images.length > 0),
            imageCount: postData.embed.images ? postData.embed.images.length : 0,
            hasExternal: !!postData.embed.external,
            externalUrl: postData.embed.external ? postData.embed.external.uri : null,
            hasRecord: !!postData.embed.record
          } : 'No embed data',
          facetsDetails: postData.facets ? postData.facets.map(facet => ({
            features: facet.features.map(f => f.$type),
            text: text.substring(facet.index.byteStart, facet.index.byteEnd)
          })) : 'No facets'
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
      const newNewsContent = generateJekyllContent(sortedNews, 'news', existingNewsContent, handle, userDid);
      fs.writeFileSync(newsFilePath, newNewsContent);
      console.log('✅ Updated news file');
    } else {
      console.log('No news posts found, keeping existing content');
    }

    // Update announcements file
    if (sortedAnnouncements.length > 0) {
      const newAnnouncementsContent = generateJekyllContent(sortedAnnouncements, 'announcements', existingAnnouncementsContent, handle, userDid);
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
