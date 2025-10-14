import { Counter } from "../../models/Counter";
import { Data } from "../../models/Data";


const managetRegistrationPaymentUpdate = (oldData:any, newData:any) => {

    if(oldData?.regPayment !== newData?.regPayment){
        newData.regPaymentUpdatedAt = new Date();
    }

    if(oldData?.serPayment !== newData?.serPayment){
        newData.serPaymentUpdatedAt = new Date();
    }

    if(oldData?.regReceived !== newData?.regReceived){
        newData.regReceivedUpdatedAt = new Date();
    }
    if(oldData?.serReceived !== newData?.serReceived){
        newData.serReceivedUpdatedAt = new Date();
    }

    return newData;


}

const createRegistrationUniqueSerialNumber = async (formType: string) => {
  const seriesTemplate: any = {
    visa: { prefix: "V", startFrom: 100000 },
    house: { prefix: "H", startFrom: 100000 },
    job: { prefix: "J", startFrom: 100000 },
    general: { prefix: "G", startFrom: 100000 },
    matrimony: { prefix: "M", startFrom: 100000 },
    bulk: { prefix: "B", startFrom: 100000 },
  };

  const series = seriesTemplate[formType] || seriesTemplate["general"];

  let counter = await Counter.findOne({ prefix: series.prefix });
  if (!counter) {
    counter = await Counter.create({
      prefix: series.prefix,
      seq: series.startFrom,
    });
  }

  const updatedCounter = await Counter.findOneAndUpdate(
    { prefix: series.prefix },
    { $inc: { seq: 1 } },
    { new: true }
  );

   if (!updatedCounter) {
    throw new Error(`Failed to update counter for prefix: ${series.prefix}`);
  }

  return `${series.prefix}${updatedCounter.seq}`;
};




export const dataControllerHooks = {
    managetRegistrationPaymentUpdate,
    createRegistrationUniqueSerialNumber
}