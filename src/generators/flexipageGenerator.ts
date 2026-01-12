/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import * as fs from 'fs';
import { nls } from '../i18n';
import { CreateUtil } from '../utils';
import { FlexipageOptions } from '../utils/types';
import {
  BaseGenerator,
  setCustomTemplatesRootPathOrGitRepo,
} from './baseGenerator';

export default class FlexipageGenerator extends BaseGenerator<FlexipageOptions> {
  private flexipageTemplatesRootPath?: string;

  constructor(options: FlexipageOptions) {
    super(options);
  }

  public validateOptions(): void {
    CreateUtil.checkInputs(this.options.flexipagename);
    CreateUtil.checkInputs(this.options.template);

    // Validate template type
    const validTemplates = ['RecordPage', 'AppPage', 'HomePage'];
    if (!validTemplates.includes(this.options.template)) {
      throw new Error(
        nls.localize('InvalidFlexipageTemplate', [
          this.options.template,
          validTemplates.join(', '),
        ])
      );
    }

    // Validate RecordPage requires entityName
    if (this.options.template === 'RecordPage' && !this.options.entityName) {
      throw new Error(nls.localize('RecordPageRequiresEntityName'));
    }

    // Ensure outputdir includes 'flexipages' folder (unless internal flag is set)
    if (!this.options.internal) {
      const fileparts = path.resolve(this.outputdir).split(path.sep);
      if (!fileparts.includes('flexipages')) {
        // Automatically append /flexipages to the output directory
        this.outputdir = path.join(this.outputdir, 'flexipages');
      }
    }
  }

  public async generate(): Promise<void> {
    const {
      flexipagename,
      template,
      flexipageTemplatesGitRepo,
      forceLoadingRemoteRepo,
      masterlabel,
      description,
    } = this.options;

    // Check if external Git repo is provided
    if (flexipageTemplatesGitRepo) {
      // Load the external flexipage templates repository
      this.flexipageTemplatesRootPath =
        await setCustomTemplatesRootPathOrGitRepo(
          flexipageTemplatesGitRepo,
          forceLoadingRemoteRepo
        );

      if (!this.flexipageTemplatesRootPath) {
        throw new Error(nls.localize('FailedToLoadFlexipageTemplatesRepo'));
      }
    } else {
      // Use local templates directory
      this.flexipageTemplatesRootPath = path.join(
        __dirname,
        '..',
        'templates',
        'flexipage'
      );
    }

    // Set source root to the template directory
    const templatePath = path.join(this.flexipageTemplatesRootPath, template);

    if (!fs.existsSync(templatePath)) {
      throw new Error(
        nls.localize('MissingFlexipageTemplate', [
          template,
          flexipageTemplatesGitRepo || 'local templates',
        ])
      );
    }

    this.sourceRoot(templatePath);

    // Generate the FlexiPage by copying and rendering all files from the template
    await this.generateFlexipageFromTemplate(
      flexipagename,
      templatePath,
      masterlabel,
      description
    );
  }

  /**
   * Recursively copy and render all files from the template directory
   * @param flexipagename The name of the FlexiPage to create
   * @param templatePath The path to the template directory
   * @param masterlabel The master label for the FlexiPage
   * @param description The description for the FlexiPage
   * @param relativePath The current relative path being processed
   */
  private async generateFlexipageFromTemplate(
    flexipagename: string,
    templatePath: string,
    masterlabel?: string,
    description?: string,
    relativePath = ''
  ): Promise<void> {
    const currentPath = path.join(templatePath, relativePath);
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryRelativePath = path.join(relativePath, entry.name);
      const sourcePath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        await this.generateFlexipageFromTemplate(
          flexipagename,
          templatePath,
          masterlabel,
          description,
          entryRelativePath
        );
      } else if (entry.isFile()) {
        // Determine destination file name
        let destinationFileName = entry.name;

        // Replace template placeholder with actual flexipage name
        if (entry.name.includes('_flexipage')) {
          destinationFileName = entry.name.replace('_flexipage', flexipagename);
        }

        const destinationPath = this.destinationPath(
          path.join(this.outputdir, destinationFileName)
        );

        // Prepare template variables
        const templateVars = {
          flexipagename,
          apiVersion: this.apiversion,
          masterlabel: masterlabel || flexipagename,
          description: description || `FlexiPage for ${flexipagename}`,
          template: this.options.template,
          entityName: this.options.entityName || '',
          primaryFields: this.options.primaryFields || [],
          secondaryFields: this.options.secondaryFields || [],
        };

        // Check if this is a file that should be rendered as a template
        if (this.isTemplateFile(entry.name)) {
          await this.render(sourcePath, destinationPath, templateVars);
        } else {
          // Copy binary files or non-template files directly
          await this.copyFile(sourcePath, destinationPath);
        }
      }
    }
  }

  /**
   * Check if a file should be treated as an EJS template
   * For FlexiPages, we only render .flexipage-meta.xml files
   * @param filename The name of the file to check
   */
  private isTemplateFile(filename: string): boolean {
    return filename.endsWith('.flexipage-meta.xml');
  }

  /**
   * Copy a file from source to destination without rendering
   * @param source The source file path
   * @param destination The destination file path
   */
  private async copyFile(source: string, destination: string): Promise<void> {
    const dir = path.dirname(destination);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Copy the file
    await fs.promises.copyFile(source, destination);

    // Register the file as created
    const relativePath = path.relative(process.cwd(), destination);
    (this.changes.created as string[]).push(relativePath);
  }
}
