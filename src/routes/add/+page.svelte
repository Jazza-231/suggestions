<script lang="ts">
	import { enhance } from "$app/forms";
	import Select from "svelte-select";
	import { labels, sleep } from "$lib";
	import { goto } from "$app/navigation";
	import Cloudinary from "./Cloudinary.svelte";
	import { tags } from "$lib/db/enums";

	const { data } = $props();
	if (!data.session) {
		// Currently this causes a flash as the alert stops the rendering, and then the goto runs immediately
		// This won't be an issue when I move to a custom popup instead of using alert
		alert("You need to be signed in to add suggestions. Redirecting you to the login page.");
		goto("/login");
	}

	const allTags = [...tags];
	const selectOptions = allTags.map((tag) => ({ value: tag, label: labels[tag] }));

	let submitting = $state(false);
	let valid = $state(true);
	let imagesUploading = $state(false);

	let images: App.Image[] = $state([]);
	$inspect(images);

	function updateImages(newImages: App.Image[]) {
		// Image might be too big to send to the server, so I remove it :D
		images = newImages.map((image) => ({ ...image, base64: "" }));

		const statuses = newImages.map((image) => image.status);
		imagesUploading =
			statuses.includes("uploading") ||
			statuses.filter((status) => status === undefined).length > 0;
	}
</script>

<div class="add-suggestion">
	<h1>Add a suggestion</h1>

	<div class="suggestion-form">
		<form
			method="POST"
			use:enhance={() => {
				submitting = true;

				return async ({ result }) => {
					submitting = false;
					if (result.status === 200) goto("/");

					if (result.type === "failure") {
						alert(result.data?.message ?? "Something went wrong");
					}
				};
			}}
			action="?/suggestion"
		>
			<input type="text" name="title" placeholder="Title" required minlength={3} maxlength={100} />
			<textarea
				name="description"
				placeholder="Description"
				required
				minlength={5}
				maxlength={1_000}
			></textarea>

			<input name="images" type="text" value={JSON.stringify(images)} hidden />

			<Select placeholder="Tag" items={selectOptions} name="tag" required searchable={false} />

			<button type="submit" disabled={submitting || !valid || imagesUploading}>Submit</button>
		</form>

		<Cloudinary {updateImages} />
	</div>
</div>

<style>
	.add-suggestion {
		display: flex;
		flex-direction: column;
		align-items: center;

		.suggestion-form {
			width: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;

			form {
				width: 50%;
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 1rem;

				@media (width <= 768px) {
					width: 90%;
				}

				input,
				textarea {
					background-color: var(--surface1);
					border: 2px transparent solid;

					&:focus {
						border: 2px var(--brand) solid;
					}
				}

				input {
					width: 100%;
				}

				textarea {
					width: 100%;
					height: 15rem;
					resize: none;
				}

				:global(.svelte-select) {
					--border: 2px transparent solid;
					--border-hover: 2px transparent solid;
					background-color: var(--surface1);

					width: 11rem;
					max-width: 90%;
				}
			}
		}
	}
</style>
