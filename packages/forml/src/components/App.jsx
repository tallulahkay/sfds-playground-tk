import { useCallback, useRef, useState } from "react";
import { Form } from "@formio/react";
import Breadcrumbs from "@/components/Breadcrumbs.jsx";

export default function App({
	form,
	listingName })
{
		// use a ref instead of state to store the live form so that we don't have
		// to recreate the pageChange handler every time the App re-renders.  that
		// then causes the Form component to re-render and re-add those event
		// handlers, which seems to deeply confuse Formio.  this way, the event
		// handlers can be created once on mount, and then reference the live form
		// through the ref.
	const liveFormRef = useRef();
	const [currentPanelKey, setCurrentPanelKey] = useState();

	const handleFormReady = (liveForm) => {
		liveFormRef.value = liveForm;
		setCurrentPanelKey(liveForm?.currentPanels[liveForm?.page]);
	};
	const handlePageChange = useCallback(({ page }) => {
		setCurrentPanelKey(liveFormRef.value?.currentPanels[page]);
	}, []);

	return (
		<div>
			<h1>{listingName} Application</h1>
			<Breadcrumbs
				form={form}
				currentPanelKey={currentPanelKey}
			/>
			<Form
				form={form}
				formReady={handleFormReady}
				onNextPage={handlePageChange}
				onPrevPage={handlePageChange}
				onSubmit={console.log}
			/>
		</div>
	);
}
