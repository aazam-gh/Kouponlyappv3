import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider } from "../lib/store";
import { router, useLocalSearchParams } from "expo-router";
import MapScreen from "../app/(tabs)/map";
import MeScreen from "../app/(tabs)/me";
import CategoryScreen from "../app/category/[slug]";
import AccountScreen from "../app/account/[section]";
import DealScreen from "../app/deal/[id]";
import ListingScreen from "../app/listing/[id]";

const params = useLocalSearchParams as jest.Mock;
const frame = { x: 0, y: 0, width: 393, height: 852 };
const wrap = async (node: React.ReactNode) => render(
  <SafeAreaProvider initialMetrics={{ frame, insets: { top: 59, left: 0, right: 0, bottom: 34 } }}>
    <StoreProvider>{node}</StoreProvider>
  </SafeAreaProvider>,
);

afterEach(() => {
  cleanup();
  params.mockReturnValue({});
  jest.clearAllMocks();
});

describe("reachable route coverage", () => {
  it("covers Me navigation and guest actions", async () => {
    const view = await wrap(<MeScreen />);
    expect(view.getByText("Your Kouponly profile")).toBeTruthy();
    await fireEvent.press(view.getByTestId("profile-sign-in"));
    expect(router.push).toHaveBeenCalledWith("/auth");
    await fireEvent.press(view.getByTestId("rewards-card"));
    expect(router.push).toHaveBeenCalledWith("/rewards");
    await fireEvent.press(view.getByTestId("creator-dashboard-earnings"));
    expect(router.push).toHaveBeenCalledWith("/account/earnings");
  });

  it("covers map search, filters, pins, location reset, and preview", async () => {
    const view = await wrap(<MapScreen />);
    expect(view.getByText("Map your next plan.")).toBeTruthy();
    await fireEvent.changeText(view.getByTestId("map-search"), "Starbucks");
    expect(view.getByText("Starbucks")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Clear map search"));
    await fireEvent.press(view.getByText("Food"));
    await fireEvent.press(view.getByLabelText("Show Centre Square partners"));
    await fireEvent.press(view.getByTestId("map-preview"));
    expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/deal\//));
  });

  it("covers category filtering and nearest sorting", async () => {
    params.mockReturnValue({ slug: "mains" });
    const view = await wrap(<CategoryScreen />);
    expect(view.getAllByText("Mains").length).toBeGreaterThan(0);
    await fireEvent.changeText(view.getByTestId("category-search"), "Biryani");
    await fireEvent.press(view.getByText("Biryani"));
    await fireEvent.press(view.getByTestId("nearest-toggle"));
    expect(view.getByText("Nearest first")).toBeTruthy();
  });

  it.each([
    ["personal", "Personal details"],
    ["savings", "Savings history"],
    ["earnings", "Your earnings"],
    ["membership", "Membership"],
    ["gifts", "Gift Kouponly"],
    ["settings", "Settings"],
    ["help", "Help & support"],
    ["feedback", "Share feedback"],
    ["legal", "Terms & privacy"],
  ])("renders account section %s", async (section, title) => {
    params.mockReturnValue({ section });
    const view = await wrap(<AccountScreen />);
    expect(view.getByText(title)).toBeTruthy();
  });

  it("covers account editing, gifts, settings, FAQs, and feedback validation", async () => {
    params.mockReturnValue({ section: "personal" });
    const personal = await wrap(<AccountScreen />);
    await fireEvent.press(personal.getByText("Edit profile"));
    expect(personal.getByText("Save changes")).toBeTruthy();
    await fireEvent.press(personal.getByText("Save changes"));
    expect(personal.getByText("Edit profile")).toBeTruthy();
    await cleanup();

    params.mockReturnValue({ section: "gifts" });
    const gifts = await wrap(<AccountScreen />);
    await fireEvent.press(gifts.getByText("Accept gift"));
    expect(gifts.getByText("Accepted")).toBeTruthy();
    await fireEvent.press(gifts.getByText("Sent"));
    await fireEvent.press(gifts.getByText("Send a gift"));
    await fireEvent.changeText(gifts.getByPlaceholderText("Recipient mobile"), "+919999");
    await fireEvent.press(gifts.getByText("Create & send claim link"));
    expect(gifts.getByText("Sent to +919999 · just now")).toBeTruthy();
    await cleanup();

    params.mockReturnValue({ section: "help" });
    const help = await wrap(<AccountScreen />);
    await fireEvent.press(help.getByText("How do I redeem an offer?"));
    expect(help.getByText(/Open the relevant offer/)).toBeTruthy();
    await cleanup();

    params.mockReturnValue({ section: "feedback" });
    const feedback = await wrap(<AccountScreen />);
    const send = feedback.getByRole("button", { name: "Send feedback" });
    expect(send.props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(feedback.getByPlaceholderText(/Tell us what worked/), "Great app");
    await fireEvent.press(feedback.getByText("Send feedback"));
    expect(feedback.getByText("Thank you for being honest")).toBeTruthy();
  });

  it("covers deal info, save, and offer entry points", async () => {
    params.mockReturnValue({ id: "1" });
    const view = await wrap(<DealScreen />);
    expect(view.getByText("Paragon Restaurant")).toBeTruthy();
    await fireEvent.press(view.getByLabelText("Save place"));
    await fireEvent.press(view.getByText("Info"));
    expect(view.getByText("PARTNER INFORMATION")).toBeTruthy();
    const closeButtons = view.getAllByLabelText("Close partner information");
    await fireEvent.press(closeButtons[closeButtons.length - 1]);
    expect(view.getByTestId("redeem-offer-0")).toBeTruthy();
  });

  it("covers listing destinations and online listing redemption", async () => {
    params.mockReturnValue({ id: "bd-intern" });
    const work = await wrap(<ListingScreen />);
    await fireEvent.press(work.getByTestId("listing-action"));
    expect(router.push).toHaveBeenCalledWith("/work");
    await cleanup();

    params.mockReturnValue({ id: "reward-coffee" });
    const rewards = await wrap(<ListingScreen />);
    await fireEvent.press(rewards.getByTestId("listing-action"));
    expect(router.push).toHaveBeenCalledWith("/rewards");
    await cleanup();

    params.mockReturnValue({ id: "backwater-cruise" });
    const online = await wrap(<ListingScreen />);
    await fireEvent.press(online.getByTestId("listing-action"));
    expect(online.getByText("Use this offer now?")).toBeTruthy();
  });
});
