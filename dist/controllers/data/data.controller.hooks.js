"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataControllerHooks = void 0;
const Counter_1 = require("../../models/Counter");
const managetRegistrationPaymentUpdate = (oldData, newData) => {
    if (oldData?.regPayment !== newData?.regPayment) {
        newData.regPaymentUpdatedAt = new Date();
    }
    if (oldData?.serPayment !== newData?.serPayment) {
        newData.serPaymentUpdatedAt = new Date();
    }
    if (oldData?.regReceived !== newData?.regReceived) {
        newData.regReceivedUpdatedAt = new Date();
    }
    if (oldData?.serReceived !== newData?.serReceived) {
        newData.serReceivedUpdatedAt = new Date();
    }
    return newData;
};
const createRegistrationUniqueSerialNumber = async (formType) => {
    const seriesTemplate = {
        visa: { prefix: "V", startFrom: 100000 },
        house: { prefix: "H", startFrom: 100000 },
        job: { prefix: "J", startFrom: 100000 },
        general: { prefix: "G", startFrom: 100000 },
        matrimony: { prefix: "M", startFrom: 100000 },
        bulk: { prefix: "B", startFrom: 100000 },
        pg: { prefix: "P" , startFrom: 100000},
    };
    const series = seriesTemplate[formType] || seriesTemplate["general"];
    let counter = await Counter_1.Counter.findOne({ prefix: series.prefix });
    if (!counter) {
        counter = await Counter_1.Counter.create({
            prefix: series.prefix,
            seq: series.startFrom,
        });
    }
    const updatedCounter = await Counter_1.Counter.findOneAndUpdate({ prefix: series.prefix }, { $inc: { seq: 1 } }, { new: true });
    if (!updatedCounter) {
        throw new Error(`Failed to update counter for prefix: ${series.prefix}`);
    }
    return `${series.prefix}${updatedCounter.seq}`;
};
exports.dataControllerHooks = {
    managetRegistrationPaymentUpdate,
    createRegistrationUniqueSerialNumber
};
//# sourceMappingURL=data.controller.hooks.js.map