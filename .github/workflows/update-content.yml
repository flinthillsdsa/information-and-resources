name: Update Content from Bluesky

on:
  schedule:
    # Run every 6 hours
    - cron: '0 */6 * * *'
  # Allow manual triggering
  workflow_dispatch:

jobs:
  update-content:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm install
        
      - name: Update content from Bluesky
        env:
          BLUESKY_HANDLE: ${{ secrets.BLUESKY_HANDLE }}
          BLUESKY_APP_PASSWORD: ${{ secrets.BLUESKY_APP_PASSWORD }}
        run: npm run update-content
        
      - name: Check for changes
        id: git-check
        run: |
          if [[ -n $(git status --porcelain) ]]; then
            echo "changes=true" >> $GITHUB_OUTPUT
            echo "Found changes in files:"
            git status --porcelain
          else
            echo "changes=false" >> $GITHUB_OUTPUT
            echo "No changes detected"
          fi
        
      - name: Commit and push changes
        if: steps.git-check.outputs.changes == 'true'
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "FHDSA Content Bot"
          git fetch origin master
          git add _portfolio/2-announcements.md _portfolio/3-news.md
          echo "Files to be committed:"
          git status --cached
          echo "Changes in files:"
          git diff --cached
          git commit -m "🤖 Update content from Bluesky posts"
          git rebase origin/master || git rebase --skip || true
          git push origin master
          
      - name: Wait for Pages to detect changes
        if: steps.git-check.outputs.changes == 'true'
        run: |
          echo "Waiting 30 seconds for GitHub Pages to detect changes..."
          sleep 30
          
      - name: Trigger Pages rebuild
        if: steps.git-check.outputs.changes == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            try {
              await github.rest.repos.requestPagesBuild({
                owner: context.repo.owner,
                repo: context.repo.repo,
              });
              console.log('Successfully triggered Pages rebuild');
            } catch (error) {
              console.log('Pages rebuild trigger failed, but this is usually okay:', error.message);
            }
        
      - name: No changes detected
        if: steps.git-check.outputs.changes != 'true'
        run: echo "No new content to update"
