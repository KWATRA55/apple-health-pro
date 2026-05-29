import HealthKit from '@kingstinct/react-native-healthkit';
import { HKCategoryTypeIdentifier } from '@kingstinct/react-native-healthkit';

async function test() {
  const samples = await HealthKit.queryCategorySamples(HKCategoryTypeIdentifier.sleepAnalysis, {
    from: new Date(),
    to: new Date()
  });
  console.log(samples[0].value);
}
