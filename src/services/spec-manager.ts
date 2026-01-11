import { SpecLoaderService } from './spec-loader.js';
import { ReferenceTransformService } from './reference-transform.js';

export interface LoadedSpec {
  slug: string;
  title: string;
  description: string;
  version: string;
  pathCount: number;
  loader: SpecLoaderService;
}

/**
 * Slugify a string for use in URIs.
 * Example: "VTEX - Catalog API" -> "vtex-catalog-api"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Manages multiple OpenAPI specifications
 */
export class SpecManagerService {
  private specs: Map<string, LoadedSpec> = new Map();

  constructor(private referenceTransform: ReferenceTransformService) {}

  /**
   * Load multiple specs and derive slugs from info.title
   */
  async loadSpecs(specPaths: string[]): Promise<void> {
    for (const filePath of specPaths) {
      const loader = new SpecLoaderService(filePath, this.referenceTransform);
      await loader.loadSpec();

      const spec = await loader.getSpec();
      const title = spec.info?.title || 'Untitled API';
      let slug = slugify(title);

      // Fallback to filename if slug is empty
      if (!slug) {
        const fileName =
          filePath
            .split('/')
            .pop()
            ?.replace(/\.(json|yaml|yml)$/i, '') || 'api';
        slug = slugify(fileName);
      }

      // First loaded wins on collision
      if (this.specs.has(slug)) {
        console.warn(`Spec slug "${slug}" already exists. Skipping: ${filePath}`);
        continue;
      }

      const pathCount = spec.paths ? Object.keys(spec.paths).length : 0;

      this.specs.set(slug, {
        slug,
        title,
        description: spec.info?.description || '',
        version: spec.info?.version || '',
        pathCount,
        loader,
      });
    }

    if (this.specs.size === 0) {
      throw new Error('No specs were loaded successfully.');
    }
  }

  getAllSpecs(): LoadedSpec[] {
    return Array.from(this.specs.values());
  }

  getSpecSlugs(): string[] {
    return Array.from(this.specs.keys());
  }

  getSpec(slug: string): LoadedSpec | undefined {
    return this.specs.get(slug);
  }

  getLoader(slug: string): SpecLoaderService {
    const spec = this.specs.get(slug);
    if (!spec) {
      throw new Error(`Spec "${slug}" not found. Available: ${this.getSpecSlugs().join(', ')}`);
    }
    return spec.loader;
  }
}
