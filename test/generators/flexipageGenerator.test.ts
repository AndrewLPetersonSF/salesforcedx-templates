/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as chai from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import { TemplateService, TemplateType } from '../../src';
import FlexipageGenerator from '../../src/generators/flexipageGenerator';
import { getDefaultApiVersion } from '../../src/generators/baseGenerator';

chai.config.truncateThreshold = 100000;
const { expect } = chai;

async function remove(file: string) {
  await fs.promises.rm(file, { force: true, recursive: true });
}

function assertFileExists(file: string) {
  const exists = fs.existsSync(file);
  expect(exists, `Expected file to exist: ${file}`).to.be.true;
}

function assertFileContent(file: string, regex: string | RegExp) {
  const exists = fs.existsSync(file);
  expect(exists, `File does not exist: ${file}`).to.be.true;

  const body = fs.readFileSync(file, 'utf8');

  let match = false;
  if (typeof regex === 'string') {
    match = body.indexOf(regex) !== -1;
  } else {
    match = regex.test(body);
  }

  expect(match, `${file} did not match '${regex}'. Contained:\n\n${body}`).to.be
    .true;
}

describe('FlexipageGenerator', () => {
  const apiVersion = getDefaultApiVersion();
  const outputDir = path.join('testsoutput', 'flexipages');

  beforeEach(async () => {
    await remove(outputDir);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('validateOptions', () => {
    it('should validate flexipagename is provided', () => {
      expect(() => {
        new FlexipageGenerator({
          flexipagename: '',
          template: 'HomePage',
          outputdir: outputDir,
          internal: true,
        });
      }).to.throw();
    });

    it('should validate template is provided', () => {
      expect(() => {
        new FlexipageGenerator({
          flexipagename: 'TestPage',
          template: '' as any,
          outputdir: outputDir,
          internal: true,
        });
      }).to.throw();
    });

    it('should validate template is one of the valid types', () => {
      expect(() => {
        new FlexipageGenerator({
          flexipagename: 'TestPage',
          template: 'InvalidTemplate' as any,
          outputdir: outputDir,
          internal: true,
        });
      }).to.throw(/Invalid.*template/i);
    });

    it('should validate RecordPage requires entityName', () => {
      expect(() => {
        new FlexipageGenerator({
          flexipagename: 'TestPage',
          template: 'RecordPage',
          outputdir: outputDir,
          internal: true,
        });
      }).to.throw(/entityName/i);
    });
  });

  describe('generate HomePage', () => {
    it('should create HomePage FlexiPage with local templates', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      const result = await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'MyHomePage',
        template: 'HomePage',
        outputdir: outputDir,
        apiversion: apiVersion,
        masterlabel: 'My Home Page',
        description: 'Test home page',
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'MyHomePage.flexipage-meta.xml'
      );

      expect(result.created).to.have.lengthOf(1);
      assertFileExists(expectedFile);
      assertFileContent(expectedFile, '<type>HomePage</type>');
      assertFileContent(expectedFile, '<name>home:desktopTemplate</name>');
      assertFileContent(
        expectedFile,
        '<masterLabel>My Home Page</masterLabel>'
      );
      assertFileContent(
        expectedFile,
        '<description>Test home page</description>'
      );
      assertFileContent(expectedFile, '<name>top</name>');
      assertFileContent(expectedFile, '<name>bottomLeft</name>');
      assertFileContent(expectedFile, '<name>bottomRight</name>');
      assertFileContent(expectedFile, '<name>sidebar</name>');
    });

    it('should use default label and description when not provided', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'DefaultHomePage',
        template: 'HomePage',
        outputdir: outputDir,
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'DefaultHomePage.flexipage-meta.xml'
      );

      assertFileExists(expectedFile);
      assertFileContent(
        expectedFile,
        '<masterLabel>DefaultHomePage</masterLabel>'
      );
      assertFileContent(
        expectedFile,
        '<description>FlexiPage for DefaultHomePage</description>'
      );
    });
  });

  describe('generate AppPage', () => {
    it('should create AppPage FlexiPage with local templates', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      const result = await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'MyAppPage',
        template: 'AppPage',
        outputdir: outputDir,
        masterlabel: 'My App Page',
        description: 'Test app page',
        internal: true,
      });

      const expectedFile = path.join(outputDir, 'MyAppPage.flexipage-meta.xml');

      expect(result.created).to.have.lengthOf(1);
      assertFileExists(expectedFile);
      assertFileContent(expectedFile, '<type>AppPage</type>');
      assertFileContent(expectedFile, '<masterLabel>My App Page</masterLabel>');
      assertFileContent(
        expectedFile,
        '<description>Test app page</description>'
      );
    });
  });

  describe('generate RecordPage', () => {
    it('should create RecordPage FlexiPage with entityName', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      const result = await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'AccountRecordPage',
        template: 'RecordPage',
        outputdir: outputDir,
        entityName: 'Account',
        masterlabel: 'Account Record Page',
        description: 'Test account record page',
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'AccountRecordPage.flexipage-meta.xml'
      );

      expect(result.created).to.have.lengthOf(1);
      assertFileExists(expectedFile);
      assertFileContent(expectedFile, '<type>RecordPage</type>');
      assertFileContent(expectedFile, 'Account');
      assertFileContent(
        expectedFile,
        '<masterLabel>Account Record Page</masterLabel>'
      );
    });

    it('should create RecordPage with primary and secondary fields', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'OpportunityPage',
        template: 'RecordPage',
        outputdir: outputDir,
        entityName: 'Opportunity',
        primaryFields: ['Name', 'Amount'],
        secondaryFields: ['Stage', 'CloseDate', 'Owner'],
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'OpportunityPage.flexipage-meta.xml'
      );

      assertFileExists(expectedFile);
      assertFileContent(expectedFile, 'Opportunity');
      assertFileContent(expectedFile, 'Name');
      assertFileContent(expectedFile, 'Amount');
      assertFileContent(expectedFile, 'Stage');
      assertFileContent(expectedFile, 'CloseDate');
      assertFileContent(expectedFile, 'Owner');
    });

    it('should create RecordPage for custom object', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'CustomObjectPage',
        template: 'RecordPage',
        outputdir: outputDir,
        entityName: 'Custom_Object__c',
        primaryFields: ['Name'],
        secondaryFields: ['Custom_Field__c'],
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'CustomObjectPage.flexipage-meta.xml'
      );

      assertFileExists(expectedFile);
      assertFileContent(expectedFile, 'Custom_Object__c');
      assertFileContent(expectedFile, 'Custom_Field__c');
    });
  });

  describe('file naming', () => {
    it('should replace _flexipage placeholder with actual name', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'TestNaming',
        template: 'HomePage',
        outputdir: outputDir,
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'TestNaming.flexipage-meta.xml'
      );
      const unexpectedFile = path.join(
        outputDir,
        '_flexipage.flexipage-meta.xml'
      );

      assertFileExists(expectedFile);
      expect(
        fs.existsSync(unexpectedFile),
        'Template placeholder file should not exist'
      ).to.be.false;
    });
  });

  describe('template rendering', () => {
    it('should render EJS variables in templates', async () => {
      const templateService = TemplateService.getInstance(process.cwd());
      await templateService.create(TemplateType.Flexipage, {
        flexipagename: 'VariableTest',
        template: 'HomePage',
        outputdir: outputDir,
        apiversion: '62.0',
        masterlabel: 'Variable Test Page',
        description: 'Testing EJS variables',
        internal: true,
      });

      const expectedFile = path.join(
        outputDir,
        'VariableTest.flexipage-meta.xml'
      );

      assertFileContent(
        expectedFile,
        '<masterLabel>Variable Test Page</masterLabel>'
      );
      assertFileContent(
        expectedFile,
        '<description>Testing EJS variables</description>'
      );
    });
  });
});
