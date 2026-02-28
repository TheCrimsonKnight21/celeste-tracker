import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface CelesteLevelData { levels: any[]; }

// determine current directory similar to __dirname in CJS
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// read JSON from workspace root
const jsonPath = path.resolve(__dirname, '../CelesteLevelData.json');

// parse mechanic mappings by looking at the TS source file
const mappingText = fs.readFileSync(path.resolve(__dirname, '../src/Logic/mechanicsMapping.ts'), 'utf-8');
const entries = [...mappingText.matchAll(/['"]([^'"]+)['"]\s*:\s*\{\s*logicKey\s*:\s*['"]([^'"]+)['"]/g)];
const mechanicMap: Record<string,string> = {};
entries.forEach(m => {
  mechanicMap[m[1]] = m[2];
});

const norm = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const lookup: Record<string,string> = {};
Object.entries(mechanicMap).forEach(([ap,lk]) => {
  lookup[norm(ap)] = lk;
});
Object.values(mechanicMap).forEach(lk => {
  lookup[norm(lk)] = lk;
});

async function main() {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as CelesteLevelData;
  let unmapped = new Set<string>();
  const ruleMap: Record<string,string[]> = {};

  raw.levels.forEach(lvl => {
    lvl.rooms.forEach((room: { name: string; regions: { locations: any; }[]; }) => {
      room.regions.forEach((reg: { locations: any; }) => {
        (reg.locations||[]).forEach((loc: any) => {
          let suffix: string;
          if (loc.type === 'strawberry') {
            suffix = `Room ${room.name} ${loc.display_name}`;
          } else {
            suffix = loc.display_name;
          }
          const apName = `${lvl.display_name} - ${suffix}`;

          const rule = loc.rule && loc.rule.length > 0 ? loc.rule[0] : [];
          const keys: string[] = [];
          rule.forEach((mech:string) => {
            const n = norm(mech);
            const key = lookup[n] || lookup['has'+n];
            if (key) {
              keys.push(key);
            } else {
              unmapped.add(mech);
            }
          });
          ruleMap[apName] = keys;
        });
      });
    });
  });

  console.log('mapped locations', Object.keys(ruleMap).length);
  const withReq = Object.entries(ruleMap).filter(([,k]) => k.length > 0);
  console.log('locations with requirements', withReq.length);

  console.log('\nkey requirements:');
  withReq.forEach(([name, keys]) => {
    if (keys.some(k => k.startsWith('has') && /Key/.test(k))) {
      console.log(name, '=>', keys);
    }
  });

  console.log('\nB/C golden strawberries:');
  withReq.forEach(([name, keys]) => {
    if (name.includes('Golden Strawberry') && (name.includes(' B - ') || name.includes(' C - '))) {
      console.log(name, '=>', keys);
    }
  });

  console.log('\nunmapped count', unmapped.size);
  console.log([...unmapped].sort());
}

main().catch(console.error);
