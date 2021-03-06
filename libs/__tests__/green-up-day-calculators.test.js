import moment from "moment";
import {
    getNextGreenUpDay,
    getCurrentGreenUpDay,
    getGreenUpDayByYear,
    dateIsInCurrentEventWindow,
    daysUntilCurrentGreenUpDay
} from "../green-up-day-calucators";

const addDays = (date, days) => new Date(date).setDate(new Date(date).getDate() + days);

describe("getCurrentGreenUpDay", () => {
    it("returns this year's green up day if today if before Green Up Day", () => {
        const myGUDay = getCurrentGreenUpDay(new Date("2019-01-01"));
        const expectedDate = moment("2019-05-04").toDate();
        expect(myGUDay).toMatchObject(expectedDate);
    });
    it("returns the Green Up Day for next year if today is more than a week later than this year's Green Up Day", () => {
        const myGUDay = getCurrentGreenUpDay(new Date("2019-07-01"));
        const expectedDate = moment("2020-05-30").toDate(); // remember the 2020 GU day moved to the end of the month
        expect(myGUDay).toMatchObject(expectedDate);
    });
    it("returns this year's Green Up Day today less than a week later than this year's Green Up Day", () => {
        const myGUDay = getCurrentGreenUpDay(new Date("2019-05-07"));
        const expectedDate = moment("2019-05-04").toDate();
        expect(myGUDay).toMatchObject(expectedDate);
    });
});

describe("getNextGreenUpDay", () => {
    it("on March 1st, 2017 the next green up day is March 6th, 2017", () => {
        const guDay = getNextGreenUpDay( moment("2017-05-01").toDate() );
        const expectedDate = moment("2017-05-06").toDate();
        expect(guDay).toMatchObject(expectedDate);
    });
    it("on March 6th, 2017 the next green up day is same day (March 6th, 2017)", () => {
        const guDay = getNextGreenUpDay( moment("2017-05-06").toDate() );
        const expectedDate = moment("2017-05-06").toDate();
        expect(guDay).toMatchObject(expectedDate);
    });
    it("on March 7th, 2017 the next green up day is March 5th, 2018", () => {
        const guDay = getNextGreenUpDay( moment("2017-05-07").toDate() );
        const expectedDate = moment("2018-05-05").toDate();
        expect(guDay).toMatchObject(expectedDate);
    });
});

describe("getGreenUpDayByYear", () => {
    it("returns the Green Up Day for the given year", () => {
        const gu2019 = getGreenUpDayByYear(2019);
        const expectedDate = moment("2019-05-04").toDate();
        expect(gu2019).toMatchObject(expectedDate);
    });
    it("returns the Green Up Day for a future year", () => {
        const gu2025 = getGreenUpDayByYear(2025);
        const expectedDate = moment("2025-05-03").toDate();
        expect(gu2025).toMatchObject(expectedDate);
    });
    it("returns the Green Up Day for a past year", () => {
        const gu2000 = getGreenUpDayByYear(2000);
        const expectedDate = moment("2000-05-06").toDate();
        expect(gu2000).toMatchObject(expectedDate);
    });
});

describe("daysUntilCurrentGreenUpDay", () => {
    it("returns zero on Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        expect(daysUntilCurrentGreenUpDay(guDay)).toBe(0);
    });
    it("returns 1 the day before Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        const daysBefore = addDays(guDay, -1);
        expect(daysUntilCurrentGreenUpDay(daysBefore)).toBe(1);
    });
    it("returns -1 the day after Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        const daysBefore = addDays(guDay, 1);
        expect(daysUntilCurrentGreenUpDay(daysBefore)).toBe(-1);
    });
});

describe("dateIsInCurrentEventWindow", () => {
    it("return false for dates 3 or more days before Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        const fakeToday = addDays(guDay, -3);
        expect(dateIsInCurrentEventWindow(fakeToday)).toBe(false);
    });
    it("return false for dates 4 or more days after Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        const fakeToday = addDays(guDay, 4);
        expect(dateIsInCurrentEventWindow(fakeToday)).toBe(false);
    });
    it("return true for Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        expect(dateIsInCurrentEventWindow(guDay)).toBe(true);
    });
    it("return true for dates 2 days or less before Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        const fakeToday = addDays(guDay, -2);
        expect(dateIsInCurrentEventWindow(fakeToday)).toBe(true);
    });
    it("return true for dates 3 days or less after Green Up Day", () => {
        const guDay = getCurrentGreenUpDay();
        const fakeToday = addDays(guDay, 3);
        expect(dateIsInCurrentEventWindow(fakeToday)).toBe(true);
    });
});