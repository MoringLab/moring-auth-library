#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/index.ts
var import_commander = require("commander");
var import_picocolors = __toESM(require("picocolors"));
var import_prompts = __toESM(require("prompts"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var program = new import_commander.Command();
program.name("moring-auth").description("CLI to initialize and configure moring-auth in your project").version("0.1.0");
program.command("init").description("Initialize moring-auth configuration").action(async () => {
  console.log(import_picocolors.default.blue("\n\u26A1 Welcome to moring-auth initializer! \u26A1\n"));
  let framework = "unknown";
  const packageJsonPath = import_path.default.join(process.cwd(), "package.json");
  if (import_fs.default.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(import_fs.default.readFileSync(packageJsonPath, "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.next) {
        framework = "nextjs";
      } else if (deps.express) {
        framework = "express";
      } else if (deps.react) {
        framework = "react";
      }
    } catch (err) {
    }
  }
  console.log(`Detected framework: ${import_picocolors.default.green(framework.toUpperCase())}`);
  const answers = await (0, import_prompts.default)([
    {
      type: "text",
      name: "issuer",
      message: "Moring SSO Issuer URL:",
      initial: "https://sso.moring.co",
      validate: (value) => value.startsWith("http") ? true : "Must be a valid URL starting with http:// or https://"
    },
    {
      type: "text",
      name: "clientId",
      message: "Moring Client ID:",
      initial: "your-client-id",
      validate: (value) => value && value.length > 0 ? true : "Client ID cannot be empty"
    },
    {
      type: "password",
      name: "clientSecret",
      message: "Moring Client Secret (Optional for client-only SPA, recommended for Node/Next.js):",
      initial: ""
    },
    {
      type: "text",
      name: "redirectUri",
      message: "Redirect URI:",
      initial: () => {
        if (framework === "nextjs") return "http://localhost:3000/api/auth/callback";
        if (framework === "express") return "http://localhost:3000/auth/callback";
        return "http://localhost:3000/callback";
      }
    }
  ]);
  if (!answers.issuer || !answers.clientId) {
    console.log(import_picocolors.default.red("Initialization aborted."));
    return;
  }
  let envContent = `
# Moring SSO Configurations
MORING_ISSUER="${answers.issuer}"
MORING_CLIENT_ID="${answers.clientId}"
`;
  if (answers.clientSecret) {
    envContent += `MORING_CLIENT_SECRET="${answers.clientSecret}"
`;
  }
  envContent += `MORING_REDIRECT_URI="${answers.redirectUri}"
`;
  const envFile = framework === "nextjs" ? ".env.local" : ".env";
  const envFilePath = import_path.default.join(process.cwd(), envFile);
  if (import_fs.default.existsSync(envFilePath)) {
    import_fs.default.appendFileSync(envFilePath, envContent);
    console.log(import_picocolors.default.green(`\u2714 Appended configurations to ${envFile}`));
  } else {
    import_fs.default.writeFileSync(envFilePath, envContent);
    console.log(import_picocolors.default.green(`\u2714 Created ${envFile} with configurations`));
  }
  if (framework === "nextjs") {
    const { createFiles } = await (0, import_prompts.default)({
      type: "confirm",
      name: "createFiles",
      message: "Would you like to automatically create the Next.js API Route for OAuth callback?",
      initial: true
    });
    if (createFiles) {
      const isSrc = import_fs.default.existsSync(import_path.default.join(process.cwd(), "src"));
      const apiDir = import_path.default.join(process.cwd(), isSrc ? "src/app/api/auth/callback" : "app/api/auth/callback");
      import_fs.default.mkdirSync(apiDir, { recursive: true });
      const routeFilePath = import_path.default.join(apiDir, "route.ts");
      const routeContent = `import { handleAuth } from '@moring-auth/nextjs';

export const GET = handleAuth({
  successRedirectUrl: '/protected',
});
`;
      import_fs.default.writeFileSync(routeFilePath, routeContent);
      console.log(import_picocolors.default.green(`\u2714 Created callback API Route at: ${import_path.default.relative(process.cwd(), routeFilePath)}`));
    }
  } else if (framework === "express") {
    const { createSnippet } = await (0, import_prompts.default)({
      type: "confirm",
      name: "createSnippet",
      message: "Would you like to write a sample Express setup code file?",
      initial: true
    });
    if (createSnippet) {
      const snippetPath = import_path.default.join(process.cwd(), "moring-auth-demo.js");
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
      import_fs.default.writeFileSync(snippetPath, snippetContent);
      console.log(import_picocolors.default.green(`\u2714 Created sample Express file: ${import_path.default.relative(process.cwd(), snippetPath)}`));
    }
  }
  console.log(import_picocolors.default.blue("\n\u{1F389} Moring Auth SDK successfully initialized! \u{1F389}\n"));
});
program.parse(process.argv);
