import { Data } from "../models/Data";
import { FormTracking } from "../models/FormTracking";
import { Staff } from "../models/Staff";
import { StaffAssignment } from "../models/StaffAssignment";

export const generateUniqueSlNo = async (): Promise<string> => {
  try {
    const highestRecord = await Data.findOne(
      {
        slNo: { $regex: /^\d{6}$/ },
      },
      {},
      { sort: { slNo: -1 } }
    );

    let nextNumber = 1;

    if (highestRecord && highestRecord.slNo) {
      const currentNumber = parseInt(highestRecord.slNo, 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    const slNo = nextNumber.toString().padStart(6, "0");

    const existingRecord = await Data.findOne({ slNo });
    if (existingRecord) {
      return (nextNumber + 1).toString().padStart(6, "0");
    }

    return slNo;
  } catch (error) {
    console.error("Error generating slNo:", error);
    const timestamp = Date.now().toString().slice(-6);
    return timestamp;
  }
};

export const generateUniqueProfileId = async (): Promise<string> => {
  try {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const randomNumber = Math.floor(Math.random() * 900000) + 100000;
      const profileId = randomNumber.toString();

      const existingRecord = await Data.findOne({ profileId });
      if (!existingRecord) {
        return profileId;
      }

      attempts++;
    }

    const timestamp = Date.now().toString().slice(-6);
    return timestamp;
  } catch (error) {
    console.error("Error generating profileId:", error);
    const timestamp = Date.now().toString().slice(-6);
    return timestamp;
  }
};

export const generateUniqueStaffId = async (
  workType: string
): Promise<string> => {
  try {
    const prefix = workType.charAt(0).toUpperCase();

    const highestRecord = await Staff.findOne(
      {
        staffId: { $regex: new RegExp(`^${prefix}\\d+$`) },
        isDeleted: false,
      },
      {},
      { sort: { staffId: -1 } }
    );

    let nextNumber = 1;

    if (highestRecord && highestRecord.staffId) {
      const numberPart = highestRecord.staffId.replace(/^[A-Z]/, "");
      const currentNumber = parseInt(numberPart, 10);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }

    return `${prefix}${nextNumber}`;
  } catch (error) {
    console.error("Error generating staffId:", error);
    const prefix = workType.charAt(0).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    return `${prefix}${timestamp}`;
  }
};

export const checkExistingStaffIds = async (): Promise<void> => {
  try {
    const homeStaff = await Staff.find({
      workType: "home",
      isDeleted: false,
    })
      .select("staffId name")
      .sort({ staffId: 1 });

    const officeStaff = await Staff.find({
      workType: "office",
      isDeleted: false,
    })
      .select("staffId name")
      .sort({ staffId: 1 });
  } catch (error) {
    console.error("Error checking existing staff IDs:", error);
  }
};

export const resetStaffAssignmentIfNeeded = async (): Promise<void> => {
  try {
    const staffAssignment = await StaffAssignment.findOne();
    if (staffAssignment) {
      staffAssignment.lastAssignedStaffId = null;
      await staffAssignment.save();
    }
  } catch (error) {
    console.error("Error resetting staff assignment:", error);
  }
};

export const generateUniqueTrackingId = async (): Promise<string> => {
  try {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let trackingId = "";

      for (let i = 0; i < 10; i++) {
        trackingId += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }

      const existingRecord = await FormTracking.findOne({ trackingId });
      if (!existingRecord) {
        return trackingId;
      }

      attempts++;
    }

    const timestamp = Date.now().toString().slice(-6);
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let fallbackId = "";

    for (let i = 0; i < 4; i++) {
      fallbackId += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    return fallbackId + timestamp;
  } catch (error) {
    console.error("Error generating trackingId:", error);
    const timestamp = Date.now().toString().slice(-6);
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let fallbackId = "";

    for (let i = 0; i < 4; i++) {
      fallbackId += characters.charAt(
        Math.floor(Math.random() * characters.length)
      );
    }

    return fallbackId + timestamp;
  }
};

export const assignStaffWithRotation = async (
  staffMembers: any[]
): Promise<{
  assignedStaffId: string;
  staffAssignment: any;
}> => {
  if (staffMembers.length === 0) {
    throw new Error("No staff members available for data assignment.");
  }

  let staffAssignment = await StaffAssignment.findOne();
  if (!staffAssignment) {
    staffAssignment = new StaffAssignment({
      lastAssignedStaffId: null,
      totalAssignedRecords: 0,
    });
    await staffAssignment.save();
  }

  let lastAssignedStaffIndex = -1;
  if (staffAssignment.lastAssignedStaffId) {
    lastAssignedStaffIndex = staffMembers.findIndex(
      (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
    );
  }

  if (lastAssignedStaffIndex === -1 && staffAssignment.lastAssignedStaffId) {
    console.log(
      `Last assigned staff (${staffAssignment.lastAssignedStaffId}) not found in current active staff. Finding next staff in rotation.`
    );

    const allStaff = await Staff.find({
      isDeleted: false,
    })
      .select("_id")
      .sort({ _id: 1 });

    const lastAssignedIndexInAll = allStaff.findIndex(
      (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
    );

    if (lastAssignedIndexInAll !== -1) {
      for (let i = 1; i < allStaff.length; i++) {
        const nextIndex = (lastAssignedIndexInAll + i) % allStaff.length;
        const nextStaff = allStaff[nextIndex];
        const activeIndex = staffMembers.findIndex(
          (staff) => staff._id.toString() === nextStaff._id.toString()
        );
        if (activeIndex !== -1) {
          lastAssignedStaffIndex = activeIndex - 1;
          console.log(
            `Found next active staff in rotation: ${nextStaff._id} at index ${activeIndex}`
          );
          break;
        }
      }
    } else {
      console.log(
        `Last assigned staff (${staffAssignment.lastAssignedStaffId}) was deleted. Finding next active staff in rotation.`
      );

      const allStaffIncludingDeleted = await Staff.find({})
        .select("_id")
        .sort({ _id: 1 });

      const deletedStaffIndex = allStaffIncludingDeleted.findIndex(
        (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
      );

      if (deletedStaffIndex !== -1) {
        for (let i = 1; i < allStaffIncludingDeleted.length; i++) {
          const nextIndex =
            (deletedStaffIndex + i) % allStaffIncludingDeleted.length;
          const nextStaff = allStaffIncludingDeleted[nextIndex];
          const activeIndex = staffMembers.findIndex(
            (staff) => staff._id.toString() === nextStaff._id.toString()
          );
          if (activeIndex !== -1) {
            lastAssignedStaffIndex = activeIndex - 1;
            console.log(
              `Found next active staff after deleted staff: ${nextStaff._id} at index ${activeIndex}`
            );
            break;
          }
        }
      }
    }

    if (lastAssignedStaffIndex === -1) {
      console.log(
        "No next active staff found in rotation. Starting from first staff."
      );
      lastAssignedStaffIndex = -1;
    }
  }

  console.log(
    `Current staff assignment state: lastAssignedStaffId=${staffAssignment.lastAssignedStaffId}, lastIndex=${lastAssignedStaffIndex}, totalRecords=${staffAssignment.totalAssignedRecords}, activeStaff=${staffMembers.length}`
  );

  const staffIndex = (lastAssignedStaffIndex + 1) % staffMembers.length;
  const assignedStaff = staffMembers[staffIndex]._id;

  staffAssignment.lastAssignedStaffId = assignedStaff.toString();
  staffAssignment.totalAssignedRecords += 1;
  await staffAssignment.save();

  return {
    assignedStaffId: assignedStaff.toString(),
    staffAssignment,
  };
};

/**
 * Assigns staff for a single record using fair rotation system with continuity support
 * This is optimized for single assignments (like submitForm)
 * @param staffMembers - Array of active staff members
 * @returns Object containing assignedStaffId and updated staffAssignment
 */
export const assignStaffForSingleRecord = async (
  staffMembers: any[]
): Promise<{
  assignedStaffId: string;
  staffAssignment: any;
}> => {
  if (staffMembers.length === 0) {
    throw new Error("No staff members available for data assignment.");
  }

  let staffAssignment = await StaffAssignment.findOne();
  if (!staffAssignment) {
    staffAssignment = new StaffAssignment({
      lastAssignedStaffId: null,
      totalAssignedRecords: 0,
    });
    await staffAssignment.save();
  }

  // Find the index of the last assigned staff in the current active staff array
  let lastAssignedStaffIndex = -1;
  if (staffAssignment.lastAssignedStaffId) {
    lastAssignedStaffIndex = staffMembers.findIndex(
      (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
    );
  }

  // If the last assigned staff is not in the current active staff array,
  // find the next staff in the original rotation sequence
  if (lastAssignedStaffIndex === -1 && staffAssignment.lastAssignedStaffId) {
    console.log(
      `Last assigned staff (${staffAssignment.lastAssignedStaffId}) not found in current active staff. Finding next staff in rotation.`
    );

    // Get all staff (including inactive but excluding deleted) to determine original sequence
    const allStaff = await Staff.find({
      isDeleted: false,
    })
      .select("_id")
      .sort({ _id: 1 }); // Sort by creation order for consistent sequence

    const lastAssignedIndexInAll = allStaff.findIndex(
      (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
    );

    if (lastAssignedIndexInAll !== -1) {
      // Last assigned staff exists (not deleted), find next active staff in rotation
      for (let i = 1; i < allStaff.length; i++) {
        const nextIndex = (lastAssignedIndexInAll + i) % allStaff.length;
        const nextStaff = allStaff[nextIndex];
        const activeIndex = staffMembers.findIndex(
          (staff) => staff._id.toString() === nextStaff._id.toString()
        );
        if (activeIndex !== -1) {
          lastAssignedStaffIndex = activeIndex - 1; // Set to previous index so next assignment goes to this staff
          console.log(
            `Found next active staff in rotation: ${nextStaff._id} at index ${activeIndex}`
          );
          break;
        }
      }
    } else {
      // Last assigned staff was deleted, find next active staff from original rotation
      console.log(
        `Last assigned staff (${staffAssignment.lastAssignedStaffId}) was deleted. Finding next active staff in rotation.`
      );

      // Get all staff including deleted to find original position
      const allStaffIncludingDeleted = await Staff.find({
        // No filter to include deleted staff
      })
        .select("_id")
        .sort({ _id: 1 });

      // Find the deleted staff's original position
      const deletedStaffIndex = allStaffIncludingDeleted.findIndex(
        (staff) => staff._id.toString() === staffAssignment.lastAssignedStaffId
      );

      if (deletedStaffIndex !== -1) {
        // Find next active staff after the deleted one
        for (let i = 1; i < allStaffIncludingDeleted.length; i++) {
          const nextIndex =
            (deletedStaffIndex + i) % allStaffIncludingDeleted.length;
          const nextStaff = allStaffIncludingDeleted[nextIndex];
          const activeIndex = staffMembers.findIndex(
            (staff) => staff._id.toString() === nextStaff._id.toString()
          );
          if (activeIndex !== -1) {
            lastAssignedStaffIndex = activeIndex - 1; // Set to previous index so next assignment goes to this staff
            console.log(
              `Found next active staff after deleted staff: ${nextStaff._id} at index ${activeIndex}`
            );
            break;
          }
        }
      }
    }

    // If no next active staff found in rotation, start from beginning
    if (lastAssignedStaffIndex === -1) {
      console.log(
        "No next active staff found in rotation. Starting from first staff."
      );
      lastAssignedStaffIndex = -1;
    }
  }

  console.log(
    `Current staff assignment state: lastAssignedStaffId=${staffAssignment.lastAssignedStaffId}, lastIndex=${lastAssignedStaffIndex}, totalRecords=${staffAssignment.totalAssignedRecords}, activeStaff=${staffMembers.length}`
  );

  const staffIndex = (lastAssignedStaffIndex + 1) % staffMembers.length;
  const assignedStaff = staffMembers[staffIndex]._id;

  // Update the last assigned staff ID for next iteration
  staffAssignment.lastAssignedStaffId = assignedStaff.toString();
  staffAssignment.totalAssignedRecords += 1;
  await staffAssignment.save();

  return {
    assignedStaffId: assignedStaff.toString(),
    staffAssignment,
  };
};

export const checkDuplicateNumbers = async (
  { mobile, whatsapp, altMobNumber }: any,
  formType: string,
  excludeId?: string // use in update mode
) => {
  const numbersToCheck = [mobile, whatsapp, altMobNumber].filter(
    (n) => n && n.trim() !== ""
  );

  if (numbersToCheck.length === 0) return null;

  const query: any = {
    $or: numbersToCheck.flatMap((num) => [
      { mobile: num },
      { whatsapp: num },
      { altMobNumber: num },
      { refferenceNumber: num },
    ]),
    data: formType,
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const duplicate = await Data.findOne(query);
  return duplicate;
};
