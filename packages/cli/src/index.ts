#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('moring-auth')
  .description('CLI to initialize and configure moring-auth in your project')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize moring-auth configuration')
  .action(async () => {
    console.log(pc.blue('\n⚡ Welcome to moring-auth initializer! ⚡\n'));

    // 1. Detect framework
    let framework: 'nextjs' | 'express' | 'react' | 'unknown' = 'unknown';
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.next) {
          framework = 'nextjs';
        } else if (deps.express) {
          framework = 'express';
        } else if (deps.react) {
          framework = 'react';
        }
      } catch (err) {}
    }

    console.log(`Detected framework: ${pc.green(framework.toUpperCase())}`);

    // 2. Prompt for configurations
    const answers = await prompts([
      {
        type: 'text',
        name: 'issuer',
        message: 'Moring SSO Issuer URL:',
        initial: 'https://sso.moring.co',
        validate: (value) => value.startsWith('http') ? true : 'Must be a valid URL starting with http:// or https://'
      },
      {
        type: 'text',
        name: 'clientId',
        message: 'Moring Client ID:',
        initial: 'your-client-id',
        validate: (value) => (value && value.length > 0) ? true : 'Client ID cannot be empty'
      },
      {
        type: 'password',
        name: 'clientSecret',
        message: 'Moring Client Secret (Optional for client-only SPA, recommended for Node/Next.js):',
        initial: ''
      },
      {
        type: 'text',
        name: 'redirectUri',
        message: 'Redirect URI:',
        initial: () => {
          if (framework === 'nextjs') return 'http://localhost:3000/api/auth/callback';
          if (framework === 'express') return 'http://localhost:3000/auth/callback';
          return 'http://localhost:3000/callback';
        }
      }
    ]);

    if (!answers.issuer || !answers.clientId) {
      console.log(pc.red('Initialization aborted.'));
      return;
    }

    // 3. Write env file
    let envContent = `\n# Moring SSO Configurations\nMORING_ISSUER="${answers.issuer}"\nMORING_CLIENT_ID="${answers.clientId}"\n`;
    if (answers.clientSecret) {
      envContent += `MORING_CLIENT_SECRET="${answers.clientSecret}"\n`;
    }
    envContent += `MORING_REDIRECT_URI="${answers.redirectUri}"\n`;

    const envFile = framework === 'nextjs' ? '.env.local' : '.env';
    const envFilePath = path.join(process.cwd(), envFile);

    if (fs.existsSync(envFilePath)) {
      fs.appendFileSync(envFilePath, envContent);
      console.log(pc.green(`✔ Appended configurations to ${envFile}`));
    } else {
      fs.writeFileSync(envFilePath, envContent);
      console.log(pc.green(`✔ Created ${envFile} with configurations`));
    }

    // 4. Generate template files
    if (framework === 'nextjs') {
      const { createFiles } = await prompts({
        type: 'confirm',
        name: 'createFiles',
        message: 'Would you like to automatically create the Next.js API Route for OAuth callback?',
        initial: true
      });

      if (createFiles) {
        const isSrc = fs.existsSync(path.join(process.cwd(), 'src'));
        const apiDir = path.join(process.cwd(), isSrc ? 'src/app/api/auth/callback' : 'app/api/auth/callback');
        fs.mkdirSync(apiDir, { recursive: true });

        const routeFilePath = path.join(apiDir, 'route.ts');
        const routeContent = `import { NextResponse } from 'next/server';
import { createMoringAuth } from '@moring-auth/core';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code missing' }, { status: 400 });
  }

  try {
    const auth = createMoringAuth();
    const tokens = await auth.handleCallback(code);
    
    // User info can be extracted from ID Token
    const user = await auth.verifyToken(tokens.id_token);

    // Save user session in cookies
    const response = NextResponse.redirect(new URL('/protected', request.url));
    
    response.cookies.set('moring_session', tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
    });

    return response;
  } catch (err: any) {
    console.error('SSO Authentication failed:', err);
    return NextResponse.json({ error: 'SSO Authentication failed', details: err.message }, { status: 500 });
  }
}
`;
        fs.writeFileSync(routeFilePath, routeContent);
        console.log(pc.green(`✔ Created callback API Route at: ${path.relative(process.cwd(), routeFilePath)}`));
      }
    } else if (framework === 'express') {
      const { createSnippet } = await prompts({
        type: 'confirm',
        name: 'createSnippet',
        message: 'Would you like to write a sample Express setup code file?',
        initial: true
      });

      if (createSnippet) {
        const snippetPath = path.join(process.cwd(), 'moring-auth-demo.js');
        const snippetContent = `const express = require('express');
const { createMoringAuth } = require('@moring-auth/core');
const { requireMoringAuth } = require('@moring-auth/express');

const app = express();

const auth = createMoringAuth();

// OAuth Login Route: Redirects to Moring SSO
app.get('/login', async (req, res) => {
  try {
    const { url } = await auth.getLoginUrl();
    res.redirect(url);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// OAuth Callback Route: exchanges code for session
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');
  
  try {
    const tokens = await auth.handleCallback(code);
    
    // Store tokens.id_token in cookies
    res.cookie('moring_session', tokens.id_token, { httpOnly: true });
    res.redirect('/secure');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Protected route using express adapter
app.get('/secure', requireMoringAuth(), (req, res) => {
  res.json({ message: 'Welcome to secure dashboard!', user: req.user });
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
`;
        fs.writeFileSync(snippetPath, snippetContent);
        console.log(pc.green(`✔ Created sample Express file: ${path.relative(process.cwd(), snippetPath)}`));
      }
    }

    console.log(pc.blue('\n🎉 Moring Auth SDK successfully initialized! 🎉\n'));
  });

program.parse(process.argv);
