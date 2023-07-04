import { expandGlobSync } from "https://deno.land/std/fs/expand_glob.ts";
import { relative } from "https://deno.land/std/path/mod.ts";
import { parse } from "https://deno.land/std/flags/mod.ts";

const flags = parse(Deno.args, {
  boolean: ["dry-run", "verbose", "with-time"],
  string: ["n"],
  default: { verbose: false, "dry-run": false, "with-time": false },
});

try {
  Deno.readTextFileSync("timing.txt");
} catch (e) {
  console.log(e);
  console.log(
    "timing.txt missing. run ./run-tests.sh with QUARTO_TEST_TIMING='timing.txt'",
  );
  Deno.exit(1);
}

const lines = Deno.readTextFileSync("timing.txt").trim().split("\n");
const currentTests = new Set(
  [...expandGlobSync("**/*.test.ts", { globstar: true })].map((entry) =>
    `./${relative(Deno.cwd(), entry.path)}`
  ),
);
const timedTests = new Set<string>();

type Timing = {
  real: number;
  user: number;
  sys: number;
};
type TestTiming = {
  name: string;
  timing: Timing;
};

const testTimings: TestTiming[] = [];

const RegSmokeAllFile = new RegExp("^\.\/smoke\/smoke-all\.test\.ts");

for (let i = 0; i < lines.length; i += 2) {
  const name = lines[i].trim();
  if (RegSmokeAllFile.test(name)) {
    // checking smoke file existence
    const smokeFile = name.split(" -- ")[1];
    const currentSmokeFiles = new Set(
      [...expandGlobSync("docs/smoke-all/**/*.{qmd,ipynb}", { globstar: true })]
        .map((entry) => `${relative(Deno.cwd(), entry.path)}`),
    );
    if (!currentSmokeFiles.has(smokeFile)) {
      flags.verbose &&
        console.log(
          `Test ${name} in timing.txt does not exists anymore. Update timing.txt with 'run ./run-tests.sh with QUARTO_TEST_TIMING='timing.txt'`,
        );
      continue;
    }
  } else {
    if (!currentTests.has(name)) {
      flags.verbose &&
        console.log(
          `Test ${name} in timing.txt does not exists anymore. Update timing.txt with 'run ./run-tests.sh with QUARTO_TEST_TIMING='timing.txt'`,
        );
      continue;
    }
  }
  const timingStrs = lines[i + 1].trim().replaceAll(/ +/g, " ").split(" ");
  const timing = {
    real: Number(timingStrs[0]),
    user: Number(timingStrs[2]),
    sys: Number(timingStrs[4]),
  };
  testTimings.push({ name, timing });
  timedTests.add(name);
}
let failed = false;

// console.log(
//   testTimings.map((a) => (a.timing.real)).reduce((a, b) => a + b, 0),
// );
// console.log(testTimings.sort((a, b) => a.timing.real - b.timing.real));
// Deno.exit(0);

const buckets: TestTiming[][] = [];
const nBuckets = Number(flags.n) || navigator.hardwareConcurrency;
const bucketSizes = (new Array(nBuckets)).fill(0);

const argmin = (a: number[]): number => {
  let best = -1, bestValue = Infinity;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] < bestValue) {
      best = i;
      bestValue = a[i];
    }
  }
  return best;
};

for (let i = 0; i < nBuckets; ++i) {
  buckets.push([]);
}

for (const timing of testTimings) {
  const ix = argmin(bucketSizes);
  buckets[ix].push(timing);
  bucketSizes[ix] += timing.timing.real;
}

for (const currentTest of currentTests) {
  if (!timedTests.has(currentTest) && !RegSmokeAllFile.test(currentTest)) {
    flags.verbose && console.log(`Missing test ${currentTest} in timing.txt`);
    failed = true;
    // add missing timed tests, randomly to buckets
    buckets[Math.floor(Math.random() * nBuckets)].push({
      name: currentTest,
      timing: { real: 0, user: 0, sys: 0 },
    });
  }
}

flags.verbose && console.log(`Will run in ${nBuckets} cores`);
if (!failed && flags.verbose) {
  console.log(
    `Expected speedup: ${
      (bucketSizes.reduce((a, b) => a + b, 0) / Math.max(...bucketSizes))
        .toFixed(
          2,
        )
    }`,
  );
}

if (flags["dry-run"]) {
  flags.verbose && console.log("Buckets of tests to run in parallel");
  const bucketSimple = buckets.map((bucket) => {
    return bucket.map((tt) => {
      tt.name = RegSmokeAllFile.test(tt.name)
        ? tt.name.split(" -- ")[1]
        : tt.name;
      return tt.name;
    });
  });
  //flags.verbose && console.log(buckets.map((e) => e.length));
  console.log(JSON.stringify(bucketSimple, null, 2));
} else {
  console.log("Running `run-test.sh` in parallel... ");
  Promise.all(buckets.map((bucket, i) => {
    const cmd: string[] = ["./run-tests.sh"];
    cmd.push(...bucket.map((tt) => tt.name));
    return Deno.run({
      cmd,
      env: flags["with-time"] ? { QUARTO_TEST_TIMING: `timing-${i}.txt` } : {},
    }).status();
  })).then(() => {
    console.log("Running `run-test.sh` in parallel... END");
    if (flags["with-time"]) {
      try {
        Deno.removeSync("timing.txt");
      } catch (_e) {
        null;
      }
      for (const f of Deno.readDirSync(".")) {
        if (/^timing-/.test(f.name)) {
          console.log(f.name);
          const text = Deno.readTextFileSync(f.name);
          Deno.writeTextFileSync("timing.txt", text, { append: true });
          try {
            Deno.removeSync(f.name);
          } catch (_e) {
            null;
          }
        }
      }
    }
  });
}
