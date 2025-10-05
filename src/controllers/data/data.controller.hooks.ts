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

const createRegistrationUniqueSerialNumber = async (formType:string) => {

    const seriesTemplate:any ={
        visa:{
            prefix:"V",
            startFrom:1000
        },
        house:{
            prefix:"H",
            startFrom:1000
        },
        job:{
            prefix:"J",
            startFrom:1000
        },
        general:{
            prefix:"G",
            startFrom:1000
        },
        matrimony:{
            prefix:"M",
            startFrom:100000
        },
        bulk:{
            prefix:"B",
            startFrom:1000
        }
    }

    const dataType = formType; 
    const series = seriesTemplate[dataType] || seriesTemplate['general'];
    const query = {profileId: { $regex: `^${series.prefix}` } };
   
    const latestEntry = await Data.findOne(query).sort({ slNo: -1 }).exec();
    let newSerialNumber;
    if (latestEntry && latestEntry.profileId) {
        const latestNumber = parseInt(latestEntry.profileId.replace(series.prefix, ''));
        newSerialNumber = series.prefix + (latestNumber + 1);
    } else {
        newSerialNumber = series.prefix + series.startFrom;
    }
    return newSerialNumber;

}



export const dataControllerHooks = {
    managetRegistrationPaymentUpdate,
    createRegistrationUniqueSerialNumber
}